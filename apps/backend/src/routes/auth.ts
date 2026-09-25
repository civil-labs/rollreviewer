import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import * as oidc from 'openid-client';
import { env } from '../config.js';
import { generatePkcePair, sanitizeReturnTo, getOidcConfig } from '../oidc.js';
import { storeAuthState, getAndConsumeAuthState, storeSession } from '../valkey.js';

export const authRestRouter = new Hono();

/**
 * GET /api/auth/login
 * Initiates OIDC BFF Authorization Code Flow with PKCE & state
 */
authRestRouter.get('/login', async (c) => {
  const rawReturnTo = c.req.query('returnTo');
  const returnTo = sanitizeReturnTo(rawReturnTo);

  const { codeVerifier, codeChallenge, state } = await generatePkcePair();

  // Store state in Valkey (5 min TTL)
  await storeAuthState({ state, codeVerifier, returnTo });

  const oidcConf = await getOidcConfig();

  const authUrl = oidc.buildAuthorizationUrl(oidcConf, {
    redirect_uri: env.OC_RR_OIDC_REDIRECT_URI,
    scope: env.OC_RR_OIDC_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return c.redirect(authUrl.href, 307);
});

/**
 * GET /api/auth/callback
 * Handles OAuth callback, exchanges code for tokens, sets HttpOnly cookie, redirects to returnTo
 */
authRestRouter.get('/callback', async (c) => {
  const currentUrl = new URL(c.req.url);
  const stateParam = currentUrl.searchParams.get('state');

  if (!stateParam) {
    return c.text('Bad Request: Missing state parameter', 400);
  }

  const savedState = await getAndConsumeAuthState(stateParam);
  if (!savedState) {
    return c.text('Bad Request: Invalid or expired auth state', 400);
  }

  try {
    const oidcConf = await getOidcConfig();
    const tokenSet = await oidc.authorizationCodeGrant(oidcConf, currentUrl, {
      pkceCodeVerifier: savedState.codeVerifier,
    });

    const claims = (tokenSet.claims() || {}) as Record<string, unknown>;
    const sessionId = `sess_${crypto.randomUUID()}`;

    // Standard user profile mapping
    const user = {
      sub: (claims.sub as string) || 'user_demo_1',
      name: (claims.name as string) || (claims.preferred_username as string) || 'Assessor User',
      email: (claims.email as string) || 'assessor@county.gov',
      preferred_username: (claims.preferred_username as string) || 'assessor',
      email_verified: Boolean(claims.email_verified ?? true),
      roles: (claims.roles as string[]) || ['Assessor', 'TicketReviewer'],
      jurisdiction: (claims.jurisdiction as string) || 'District-4',
    };

    const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 28800) * 1000).toISOString();

    await storeSession({
      sessionId,
      user,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt,
    });

    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 28800,
    });

    return c.redirect(savedState.returnTo, 307);
  } catch (err) {
    console.error('Failed to swap token during auth callback:', err);
    return c.text('Authentication Failed', 500);
  }
});
