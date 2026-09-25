import * as oidc from 'openid-client';
import { env } from './config.js';

let oidcConfig: oidc.Configuration | null = null;

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!oidcConfig) {
    try {
      oidcConfig = await oidc.discovery(
        new URL(env.OC_RR_OIDC_ISSUER),
        env.OC_RR_OIDC_CLIENT_ID,
        env.OC_RR_OIDC_CLIENT_SECRET
      );
    } catch (err) {
      console.warn('OIDC Discovery failed, creating fallback config:', err);
      oidcConfig = new oidc.Configuration(
        {
          issuer: env.OC_RR_OIDC_ISSUER,
          authorization_endpoint: `${env.OC_RR_OIDC_ISSUER}/protocol/openid-connect/auth`,
          token_endpoint: `${env.OC_RR_OIDC_ISSUER}/protocol/openid-connect/token`,
          userinfo_endpoint: `${env.OC_RR_OIDC_ISSUER}/protocol/openid-connect/userinfo`,
        },
        env.OC_RR_OIDC_CLIENT_ID,
        env.OC_RR_OIDC_CLIENT_SECRET
      );
    }
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
    return url;
  }
  return '/';
}
