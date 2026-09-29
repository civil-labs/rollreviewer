import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { getAdminPageProcedure } from './routers/admin.js';

export const appRouter = router({
  auth: authRouter,
  getAdminPage: getAdminPageProcedure,
});

export type AppRouter = typeof appRouter;
