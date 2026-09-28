import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { AuthMeResponseSchema, AuthLogoutResponseSchema } from '@rollreviewer/contracts';
import { deleteSession } from '../valkey.js';
import { deleteCookie, getCookie } from 'hono/cookie';
import { authLogger } from '../logger.js';

export const authRouter = router({
  me: publicProcedure
    .output(AuthMeResponseSchema)
    .query(({ ctx }) => {
      authLogger.debug('Handling tRPC auth.me query', {
        hasSession: Boolean(ctx.session?.user),
        userSub: ctx.session?.user?.sub,
      });

      if (!ctx.session || !ctx.session.user) {
        return {
          isAuthenticated: false,
          user: null,
        };
      }

      return {
        isAuthenticated: true,
        user: ctx.session.user,
        expiresAt: ctx.session.expiresAt,
      };
    }),

  logout: protectedProcedure
    .output(AuthLogoutResponseSchema)
    .mutation(async ({ ctx }) => {
      const sessionId = getCookie(ctx.honoCtx, 'session_id');
      authLogger.info('Handling tRPC auth.logout mutation', {
        sessionId,
        userSub: ctx.user.sub,
      });

      if (sessionId) {
        await deleteSession(sessionId);
        deleteCookie(ctx.honoCtx, 'session_id', {
          path: '/',
        });
        authLogger.debug('Session deleted and cookie cleared for logout', { sessionId });
      }
      return {};
    }),
});
