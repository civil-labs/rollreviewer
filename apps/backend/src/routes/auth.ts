import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import * as oidc from 'openid-client';
import type { UserProfile } from '@rollreviewer/contracts';
import { env } from '../config.js';
import { generatePkcePair, sanitizeReturnTo, getOidcConfig } from '../oidc.js';
import { storeAuthState, getAndConsumeAuthState, storeSession } from '../valkey.js';
import { authLogger } from '../logger.js';

export function extractUserProfile(claims: Record<string, unknown>): UserProfile {
  let roles: string[] = [];
  if (Array.isArray(claims.roles)) {
    roles = claims.roles.map(String);
  } else if (typeof claims.roles === 'string' && claims.roles.trim() !== '') {
    roles = [claims.roles.trim()];
  } else if (Array.isArray(claims.groups)) {
    roles = claims.groups.map(String);
  } else if (typeof claims.groups === 'string' && claims.groups.trim() !== '') {
    roles = [claims.groups.trim()];
  }

  return {
    sub: typeof claims.sub === 'string' && claims.sub ? claims.sub : '',
    name:
      typeof claims.name === 'string' && claims.name
        ? claims.name
        : typeof claims.preferred_username === 'string' && claims.preferred_username
          ? claims.preferred_username
          : undefined,
    email:
      typeof claims.email === 'string' && claims.email.includes('@')
        ? claims.email
        : undefined,
    preferred_username:
      typeof claims.preferred_username === 'string' && claims.preferred_username
        ? claims.preferred_username
        : undefined,
    email_verified:
      typeof claims.email_verified === 'boolean' ? claims.email_verified : false,
    roles,
    jurisdiction:
      typeof claims.jurisdiction === 'string' && claims.jurisdiction
        ? claims.jurisdiction
        : undefined,
  };
}

export const authRestRouter = new Hono();

/**
 * GET /api/auth/login
 * Initiates OIDC BFF Authorization Code Flow with PKCE & state
 */
authRestRouter.get('/login', async (c) => {
  const rawReturnTo = c.req.query('returnTo');
  const returnTo = sanitizeReturnTo(rawReturnTo);

  authLogger.debug('Incoming /api/auth/login request', {
    rawReturnTo,
    sanitizedReturnTo: returnTo,
    hostHeader: c.req.header('host'),
    forwardedHost: c.req.header('x-forwarded-host'),
    forwardedProto: c.req.header('x-forwarded-proto'),
  });

  const { codeVerifier, codeChallenge, state } = await generatePkcePair();

  // Determine redirect URI: if default localhost is used but client accessed via another host, match client host
  const reqHost = c.req.header('x-forwarded-host') || c.req.header('host');
  let redirectUri = env.OC_RR_OIDC_REDIRECT_URI;
  if (reqHost) {
    try {
      const configuredUrl = new URL(env.OC_RR_OIDC_REDIRECT_URI);
      if (configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') {
        const proto = c.req.header('x-forwarded-proto') || 'http';
        redirectUri = `${proto}://${reqHost}/api/auth/callback`;
      }
    } catch {
      // Keep configured redirectUri if URL parsing fails
    }
  }

  authLogger.debug('Determined OIDC callback redirect URI', {
    configuredRedirectUri: env.OC_RR_OIDC_REDIRECT_URI,
    effectiveRedirectUri: redirectUri,
  });

  // Store state in Valkey (5 min TTL)
  await storeAuthState({ state, codeVerifier, returnTo, redirectUri });

  const oidcConf = await getOidcConfig();

  const authUrl = oidc.buildAuthorizationUrl(oidcConf, {
    redirect_uri: redirectUri,
    scope: env.OC_RR_OIDC_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  authLogger.info('Redirecting browser to OIDC authorization URL', {
    authUrl: authUrl.href,
    state,
    redirectUri,
  });

  // Redirect browser to authorization URL
  return c.redirect(authUrl.href, 307);
});

/**
 * GET /api/auth/callback
 * Handles OAuth callback, exchanges code for tokens, sets HttpOnly cookie, redirects to returnTo
 */
authRestRouter.get('/callback', async (c) => {
  const currentUrl = new URL(c.req.url);
  const stateParam = currentUrl.searchParams.get('state');
  const codeParam = currentUrl.searchParams.get('code');
  const errorParam = currentUrl.searchParams.get('error');
  const errorDesc = currentUrl.searchParams.get('error_description');

  authLogger.debug('Incoming /api/auth/callback request', {
    url: c.req.url,
    state: stateParam,
    hasCode: Boolean(codeParam),
    error: errorParam,
    errorDescription: errorDesc,
  });

  if (errorParam) {
    authLogger.error('OAuth provider returned error in callback', {
      error: errorParam,
      description: errorDesc,
    });
    return c.text(`OAuth Error: ${errorParam} - ${errorDesc ?? ''}`, 400);
  }

  if (!stateParam) {
    authLogger.warn('Auth callback rejected: missing state parameter');
    return c.text('Bad Request: Missing state parameter', 400);
  }

  const savedState = await getAndConsumeAuthState(stateParam);
  if (!savedState) {
    authLogger.warn('Auth callback rejected: state not found or expired', { state: stateParam });
    return c.text('Bad Request: Invalid or expired auth state', 400);
  }

  authLogger.debug('Auth state validated and consumed from Valkey', {
    state: savedState.state,
    returnTo: savedState.returnTo,
    savedRedirectUri: savedState.redirectUri,
  });

  try {
    const oidcConf = await getOidcConfig();
    const redirectUri = savedState.redirectUri || env.OC_RR_OIDC_REDIRECT_URI;
    const callbackUrl = new URL(redirectUri);
    callbackUrl.search = currentUrl.search;

    authLogger.debug('Calling authorizationCodeGrant token swap', {
      tokenEndpoint: oidcConf.serverMetadata().token_endpoint,
      callbackUrl: callbackUrl.href,
    });

    const tokenSet = await oidc.authorizationCodeGrant(oidcConf, callbackUrl, {
      pkceCodeVerifier: savedState.codeVerifier,
      expectedState: savedState.state,
    });

    authLogger.info('Successfully exchanged authorization code for tokens', {
      tokenType: tokenSet.token_type,
      expiresIn: tokenSet.expires_in,
      hasAccessToken: Boolean(tokenSet.access_token),
      hasIdToken: Boolean(tokenSet.id_token),
      hasRefreshToken: Boolean(tokenSet.refresh_token),
    });

    const claims = (tokenSet.claims() || {}) as Record<string, unknown>;
    authLogger.debug('Extracted claims from ID token', {
      iss: claims.iss,
      sub: claims.sub,
      aud: claims.aud,
      exp: claims.exp,
      email: claims.email,
      roles: claims.roles,
      preferred_username: claims.preferred_username,
    });

    const sessionId = `sess_${crypto.randomUUID()}`;

    // User profile mapping from verified ID token claims without mock or default test values
    const user = extractUserProfile(claims);

    const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 28800) * 1000).toISOString();

    authLogger.debug('Storing session data in Valkey', {
      sessionId,
      userSub: user.sub,
      userRoles: user.roles,
      expiresAt,
    });

    await storeSession({
      sessionId,
      user,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt,
    });

    const isSecure = process.env.NODE_ENV === 'production';
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 28800,
    });

    authLogger.info('Session established; redirecting user to destination', {
      sessionId,
      returnTo: savedState.returnTo,
      cookieSecure: isSecure,
    });

    return c.redirect(savedState.returnTo, 307);
  } catch (err) {
    authLogger.error('Failed to swap token during auth callback', {
      error: (err as Error).message,
      name: (err as Error).name,
      code: (err as any)?.code,
      cause: (err as any)?.cause,
      stack: (err as Error).stack,
    });
    return c.text('Authentication Failed', 500);
  }
});
