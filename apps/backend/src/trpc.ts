import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getCookie } from 'hono/cookie';
import type { Context as HonoContext } from 'hono';
import { getSession, refreshTokensIfExpired, type UserSessionData } from './valkey.js';
import { sessionLogger } from './logger.js';

export interface Context {
  session: UserSessionData | null;
  req: Request;
  honoCtx: HonoContext;
}

export async function createContext(
  _opts: FetchCreateContextFnOptions,
  c: HonoContext
): Promise<Context> {
  const sessionId = getCookie(c, 'session_id');
  let session: UserSessionData | null = null;

  if (sessionId) {
    session = await getSession(sessionId);
    // Refresh token check logic if present and expired
    if (session && isExpired(session.expiresAt) && session.refreshToken) {
      sessionLogger.debug('Session expired; attempting refresh', {
        sessionId,
        expiredAt: session.expiresAt,
      });
      session = await refreshTokensIfExpired(session);
    }
  }

  sessionLogger.debug('Created tRPC context', {
    hasCookie: Boolean(sessionId),
    isAuthenticated: Boolean(session?.user),
    userSub: session?.user?.sub,
  });

  return {
    session,
    req: c.req.raw,
    honoCtx: c,
  };
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    sessionLogger.warn('Protected tRPC procedure access rejected: unauthorized');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.',
    });
  }
  sessionLogger.debug('Protected tRPC procedure access authorized', {
    userSub: ctx.session.user.sub,
    roles: ctx.session.user.roles,
  });
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});
