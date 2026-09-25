import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { AuthMeResponseSchema, AuthLogoutResponseSchema } from '@rollreviewer/contracts';
import { deleteSession } from '../valkey.js';
import { deleteCookie, getCookie } from 'hono/cookie';

export const authRouter = router({
  me: publicProcedure
    .output(AuthMeResponseSchema)
    .query(({ ctx }) => {
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
      if (sessionId) {
        await deleteSession(sessionId);
        deleteCookie(ctx.honoCtx, 'session_id', {
          path: '/',
        });
      }
      return {};
    }),
});
