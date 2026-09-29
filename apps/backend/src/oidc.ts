import * as oidc from 'openid-client';
import { env } from './config.js';
import { oidcLogger } from './logger.js';

let oidcConfig: oidc.Configuration | null = null;

export function resetOidcConfig(): void {
  oidcLogger.debug('Resetting OIDC configuration cache');
  oidcConfig = null;
}

export async function getOidcConfig(configOverride?: Partial<typeof env>): Promise<oidc.Configuration> {
  if (!oidcConfig || configOverride) {
    const activeEnv = configOverride ? { ...env, ...configOverride } : env;
    oidcLogger.debug('Initializing OIDC configuration...', {
      issuer: activeEnv.OC_RR_OIDC_ISSUER,
      tokenUrl: activeEnv.OC_RR_OIDC_TOKEN_URL ?? '(not set - using issuer)',
      authUrl: activeEnv.OC_RR_OIDC_AUTH_URL ?? '(not set - using issuer)',
      clientId: activeEnv.OC_RR_OIDC_CLIENT_ID,
      redirectUri: activeEnv.OC_RR_OIDC_REDIRECT_URI,
      isOverride: Boolean(configOverride),
    });

    const issuerUrl = new URL(activeEnv.OC_RR_OIDC_ISSUER);
    const tokenUrl = activeEnv.OC_RR_OIDC_TOKEN_URL
      ? new URL(activeEnv.OC_RR_OIDC_TOKEN_URL)
      : issuerUrl;
    const authUrl = activeEnv.OC_RR_OIDC_AUTH_URL
      ? new URL(activeEnv.OC_RR_OIDC_AUTH_URL)
      : issuerUrl;

    const isNotProduction = activeEnv.OC_RR_NODE_ENV !== 'production';
    const isAuthHttp = authUrl.protocol === 'http:';
    const allowInsecure = isNotProduction && isAuthHttp;

    oidcLogger.debug('Evaluated allowInsecureRequests gate', {
      nodeEnv: activeEnv.OC_RR_NODE_ENV,
      authUrlProtocol: authUrl.protocol,
      isNotProduction,
      isAuthHttp,
      allowInsecure,
    });

    let discoveredMetadata: Record<string, unknown> = {};

    const tokenBasePath = tokenUrl.pathname.replace(/\/$/, '');
    const authBasePath = authUrl.pathname.replace(/\/$/, '');

    // Attempt discovery from internal token/cluster service first, then authUrl/issuer
    const discoveryCandidates = [
      new URL(`${tokenBasePath}/.well-known/openid-configuration`, tokenUrl),
      new URL('/.well-known/openid-configuration', tokenUrl),
      new URL(`${authBasePath}/.well-known/openid-configuration`, authUrl),
      new URL('/.well-known/openid-configuration', authUrl),
    ];

    oidcLogger.debug('Probing OIDC discovery candidate endpoints', {
      candidates: discoveryCandidates.map((c) => c.href),
    });

    for (const endpoint of discoveryCandidates) {
      try {
        oidcLogger.debug('Querying discovery candidate endpoint', { endpoint: endpoint.href });
        const resp = await fetch(endpoint.href, { headers: { accept: 'application/json' } });
        if (resp.ok) {
          discoveredMetadata = (await resp.json()) as Record<string, unknown>;
          oidcLogger.debug('Successfully retrieved OIDC discovery metadata', {
            endpoint: endpoint.href,
            discoveredIssuer: discoveredMetadata.issuer,
            discoveredAuthEndpoint: discoveredMetadata.authorization_endpoint,
            discoveredTokenEndpoint: discoveredMetadata.token_endpoint,
            discoveredJwksUri: discoveredMetadata.jwks_uri,
          });
          break;
        } else {
          oidcLogger.debug('Discovery candidate returned non-OK status', {
            endpoint: endpoint.href,
            status: resp.status,
            statusText: resp.statusText,
          });
        }
      } catch (err) {
        oidcLogger.debug('Discovery probe failed for endpoint', {
          endpoint: endpoint.href,
          error: (err as Error).message,
        });
      }
    }

    // Authorization Endpoint: Browser-facing, uses authUrl host & protocol
    let authEndpoint = authUrl.pathname.endsWith('/authorize')
      ? authUrl.href
      : `${authUrl.origin}${authBasePath}/authorize`;
    if (!activeEnv.OC_RR_OIDC_AUTH_URL && typeof discoveredMetadata.authorization_endpoint === 'string') {
      authEndpoint = discoveredMetadata.authorization_endpoint;
      oidcLogger.debug('Using discovered authorization_endpoint (OC_RR_OIDC_AUTH_URL not set)', {
        authEndpoint,
      });
    } else if (activeEnv.OC_RR_OIDC_AUTH_URL) {
      oidcLogger.debug('Using explicitly configured OC_RR_OIDC_AUTH_URL; ignored discovery', {
        authEndpoint,
      });
    }

    // Token Endpoint: Backend-facing (token swap), uses tokenUrl host & protocol
    let tokenEndpoint = tokenUrl.pathname.endsWith('/token')
      ? tokenUrl.href
      : `${tokenUrl.origin}${tokenBasePath}/token`;
    if (!activeEnv.OC_RR_OIDC_TOKEN_URL && typeof discoveredMetadata.token_endpoint === 'string') {
      tokenEndpoint = discoveredMetadata.token_endpoint;
      oidcLogger.debug('Using discovered token_endpoint (OC_RR_OIDC_TOKEN_URL not set)', {
        tokenEndpoint,
      });
    } else if (activeEnv.OC_RR_OIDC_TOKEN_URL) {
      oidcLogger.debug('Using explicitly configured OC_RR_OIDC_TOKEN_URL; ignored discovery', {
        tokenEndpoint,
      });
    }

    // JWKS URI: Backend-facing (signature verification keys)
    let jwksUri = tokenUrl.pathname.endsWith('/jwks')
      ? tokenUrl.href
      : `${tokenUrl.origin}${tokenBasePath}/jwks`;
    if (typeof discoveredMetadata.jwks_uri === 'string') {
      try {
        const url = new URL(discoveredMetadata.jwks_uri);
        jwksUri = `${tokenUrl.origin}${url.pathname}${url.search}`;
      } catch {
        jwksUri = discoveredMetadata.jwks_uri;
      }
    }

    // UserInfo Endpoint
    let userinfoEndpoint: string | undefined = `${tokenUrl.origin}${tokenBasePath}/userinfo`;
    if (typeof discoveredMetadata.userinfo_endpoint === 'string') {
      try {
        const url = new URL(discoveredMetadata.userinfo_endpoint);
        userinfoEndpoint = `${tokenUrl.origin}${url.pathname}${url.search}`;
      } catch {
        userinfoEndpoint = undefined;
      }
    }

    // If HTTPS is strictly enforced (allowInsecure is false), ensure backchannel endpoints
    // use https: in metadata so oauth4webapi endpoint validation passes before customFetch downgrades it
    if (!allowInsecure) {
      if (tokenEndpoint.startsWith('http:')) {
        tokenEndpoint = tokenEndpoint.replace(/^http:/, 'https:');
      }
      if (jwksUri.startsWith('http:')) {
        jwksUri = jwksUri.replace(/^http:/, 'https:');
      }
      if (userinfoEndpoint?.startsWith('http:')) {
        userinfoEndpoint = userinfoEndpoint.replace(/^http:/, 'https:');
      }
      oidcLogger.debug('Strict HTTPS protocol enforced for metadata endpoints', {
        tokenEndpoint,
        jwksUri,
        userinfoEndpoint,
      });
    }

    const serverMetadata: Record<string, unknown> = {
      ...discoveredMetadata,
      // Canonical issuer used for ID token 'iss' claim validation
      issuer: activeEnv.OC_RR_OIDC_ISSUER,
      authorization_endpoint: authEndpoint,
      token_endpoint: tokenEndpoint,
      jwks_uri: jwksUri,
      ...(userinfoEndpoint ? { userinfo_endpoint: userinfoEndpoint } : {}),
      response_types_supported: (discoveredMetadata.response_types_supported as string[]) || ['code'],
    };

    oidcLogger.debug('Final OIDC server metadata prepared', {
      issuer: serverMetadata.issuer,
      authorization_endpoint: serverMetadata.authorization_endpoint,
      token_endpoint: serverMetadata.token_endpoint,
      jwks_uri: serverMetadata.jwks_uri,
      userinfo_endpoint: serverMetadata.userinfo_endpoint,
    });

    const config = new oidc.Configuration(
      serverMetadata as any,
      activeEnv.OC_RR_OIDC_CLIENT_ID,
      activeEnv.OC_RR_OIDC_CLIENT_SECRET
    );

    if (allowInsecure) {
      oidc.allowInsecureRequests(config);
      oidcLogger.debug('Called oidc.allowInsecureRequests(config)');
    }

    // If token endpoint is set separately from the issuer, use a custom fetch to downgrade https to http
    const hasSeparateTokenUrl = Boolean(
      activeEnv.OC_RR_OIDC_TOKEN_URL && activeEnv.OC_RR_OIDC_TOKEN_URL !== activeEnv.OC_RR_OIDC_ISSUER
    );

    if (hasSeparateTokenUrl) {
      oidcLogger.debug('Registering custom fetch downgrade handler for token endpoint', {
        configuredTokenUrl: activeEnv.OC_RR_OIDC_TOKEN_URL,
        issuer: activeEnv.OC_RR_OIDC_ISSUER,
      });

      config[oidc.customFetch] = async (url, options) => {
        const targetUrl = new URL(url);
        const originalHref = targetUrl.href;

        // Downgrade connection from https to http for backchannel communication
        if (targetUrl.protocol === 'https:') {
          targetUrl.protocol = 'http:';
          oidcLogger.debug('Downgrading backchannel connection from HTTPS to HTTP', {
            from: originalHref,
            to: targetUrl.href,
            method: options?.method ?? 'POST',
          });
        } else {
          oidcLogger.debug('Dispatching backchannel connection over HTTP', {
            url: targetUrl.href,
            method: options?.method ?? 'POST',
          });
        }

        const res = await fetch(targetUrl.href, options as RequestInit);
        oidcLogger.debug('Backchannel response received', {
          url: targetUrl.href,
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
        });
        return res;
      };
    }

    if (!configOverride) {
      oidcConfig = config;
      oidcLogger.debug('OIDC configuration successfully initialized and cached');
    }
    return config;
  }

  return oidcConfig;
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePkcePair() {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  oidcLogger.debug('Generated PKCE credentials and state', {
    state,
    codeChallenge,
    codeChallengeMethod: 'S256',
    codeVerifierLength: codeVerifier.length,
  });
  return { codeVerifier, codeChallenge, state };
}

/**
 * Sanitize returnTo links using relative path enforcement
 */
export function sanitizeReturnTo(url?: string | null): string {
  if (
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.startsWith('/\\')
  ) {
    oidcLogger.debug('Sanitized returnTo URL (allowed relative path)', { input: url, sanitized: url });
    return url;
  }
  oidcLogger.debug('Sanitized returnTo URL (fallback to /)', { input: url, sanitized: '/' });
  return '/';
}
