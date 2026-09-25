import { Redis } from 'ioredis';
import { env } from './config.js';

export const valkey = new Redis(env.OC_RR_VALKEY_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export interface OidcAuthState {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export interface UserSessionData {
  sessionId: string;
  user: {
    sub: string;
    name?: string;
    email?: string;
    preferred_username?: string;
    email_verified?: boolean;
    roles: string[];
    jurisdiction?: string;
  };
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: string;
}

/**
 * Store temporary OIDC authentication state (5 min TTL)
 */
export async function storeAuthState(authState: OidcAuthState): Promise<void> {
  await valkey.set(`oidc_state:${authState.state}`, JSON.stringify(authState), 'EX', 300);
}

/**
 * Retrieve and consume temporary OIDC auth state
 */
export async function getAndConsumeAuthState(state: string): Promise<OidcAuthState | null> {
  const key = `oidc_state:${state}`;
  const data = await valkey.get(key);
  if (!data) return null;
  await valkey.del(key);
  return JSON.parse(data) as OidcAuthState;
}

/**
 * Store user session in Valkey (8 hour TTL)
 */
export async function storeSession(session: UserSessionData): Promise<void> {
  await valkey.set(`session:${session.sessionId}`, JSON.stringify(session), 'EX', 28800);
}

/**
 * Retrieve user session from Valkey
 */
export async function getSession(sessionId: string): Promise<UserSessionData | null> {
  const data = await valkey.get(`session:${sessionId}`);
  if (!data) return null;
  return JSON.parse(data) as UserSessionData;
}

/**
 * Delete user session from Valkey
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await valkey.del(`session:${sessionId}`);
}

/**
 * Refresh user session tokens if expired
 */
export async function refreshTokensIfExpired(session: UserSessionData): Promise<UserSessionData> {
  // If refresh token exists, extend session expiry for demo/mock flow
  const updatedSession = {
    ...session,
    expiresAt: new Date(Date.now() + 28800 * 1000).toISOString(),
  };
  await storeSession(updatedSession);
  return updatedSession;
}
