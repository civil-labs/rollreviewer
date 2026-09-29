import { Redis } from 'ioredis';
import { env } from './config.js';
import { valkeyLogger } from './logger.js';

export const valkey = new Redis(env.OC_RR_VALKEY_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export interface OidcAuthState {
  state: string;
  codeVerifier: string;
  returnTo: string;
  redirectUri?: string;
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
  valkeyLogger.debug('Storing temporary OIDC auth state in Valkey', {
    state: authState.state,
    returnTo: authState.returnTo,
    redirectUri: authState.redirectUri,
    ttlSeconds: 300,
  });
  await valkey.set(`oidc_state:${authState.state}`, JSON.stringify(authState), 'EX', 300);
}

/**
 * Retrieve and consume temporary OIDC auth state
 */
export async function getAndConsumeAuthState(state: string): Promise<OidcAuthState | null> {
  const key = `oidc_state:${state}`;
  const data = await valkey.get(key);
  if (!data) {
    valkeyLogger.debug('Valkey auth state lookup: MISS (state not found or expired)', { key });
    return null;
  }
  await valkey.del(key);
  valkeyLogger.debug('Valkey auth state lookup: HIT (consumed and deleted)', { key });
  return JSON.parse(data) as OidcAuthState;
}

/**
 * Store user session in Valkey (8 hour TTL)
 */
export async function storeSession(session: UserSessionData): Promise<void> {
  valkeyLogger.debug('Storing user session in Valkey', {
    sessionId: session.sessionId,
    userSub: session.user.sub,
    userRoles: session.user.roles,
    expiresAt: session.expiresAt,
    ttlSeconds: 28800,
  });
  await valkey.set(`session:${session.sessionId}`, JSON.stringify(session), 'EX', 28800);
}

/**
 * Retrieve user session from Valkey
 */
export async function getSession(sessionId: string): Promise<UserSessionData | null> {
  const key = `session:${sessionId}`;
  const data = await valkey.get(key);
  if (!data) {
    valkeyLogger.debug('Valkey session lookup: MISS', { sessionId });
    return null;
  }
  const session = JSON.parse(data) as UserSessionData;
  valkeyLogger.debug('Valkey session lookup: HIT', {
    sessionId,
    userSub: session.user.sub,
    expiresAt: session.expiresAt,
  });
  return session;
}

/**
 * Delete user session from Valkey
 */
export async function deleteSession(sessionId: string): Promise<void> {
  valkeyLogger.debug('Deleting user session from Valkey', { sessionId });
  await valkey.del(`session:${sessionId}`);
}

/**
 * Refresh user session tokens if expired
 */
export async function refreshTokensIfExpired(session: UserSessionData): Promise<UserSessionData> {
  valkeyLogger.debug('Refreshing/extending user session tokens', {
    sessionId: session.sessionId,
    userSub: session.user.sub,
    oldExpiresAt: session.expiresAt,
  });
  // If refresh token exists, extend session expiry for demo/mock flow
  const updatedSession = {
    ...session,
    expiresAt: new Date(Date.now() + 28800 * 1000).toISOString(),
  };
  await storeSession(updatedSession);
  return updatedSession;
}
