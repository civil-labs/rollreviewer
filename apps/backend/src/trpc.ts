import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getCookie } from 'hono/cookie';
import type { Context as HonoContext } from 'hono';
import { getSession, refreshTokensIfExpired, type UserSessionData } from './valkey.js';

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
      session = await refreshTokensIfExpired(session);
    }
  }

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
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.',
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});
