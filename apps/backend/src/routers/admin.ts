import { publicProcedure } from '../trpc.js';
import { checkAdminAuthorization } from '../opa.js';
import { adminLogger } from '../logger.js';
import { TRPCError } from '@trpc/server';

/**
 * tRPC procedure to query admin page authorization.
 * Mounted at `/api/trpc/getAdminPage`.
 *
 * Requirements:
 * - Checks OPA for authorization before returning anything.
 * - Returns 403 if OPA returns user is not authorized.
 * - If authorized, returns 200 with an empty response body `{}`.
 * - If OPA is not contactable, logs error and proceeds as unauthorized (403).
 */
export const getAdminPageProcedure = publicProcedure.query(async ({ ctx }) => {
  if (!ctx.session?.user) {
    adminLogger.warn('Admin page authorization query rejected: no active session');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied: authentication session required',
    });
  }

  adminLogger.debug('Evaluating admin page authorization for user', {
    userSub: ctx.session.user.sub,
    roles: ctx.session.user.roles,
    jurisdiction: ctx.session.user.jurisdiction,
  });

  let isAuthorized = false;
  try {
    isAuthorized = await checkAdminAuthorization(ctx.session.user);
  } catch (err) {
    adminLogger.error('OPA server is not contactable; proceeding as unauthorized', {
      userSub: ctx.session.user.sub,
      error: (err as Error).message,
    });

    // "If OPA is not contactable, throw an error but proceed as if the user is unauthorized"
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied: authorization service unavailable',
      cause: err,
    });
  }

  if (!isAuthorized) {
    adminLogger.warn('Admin page access denied by OPA policy', {
      userSub: ctx.session.user.sub,
      roles: ctx.session.user.roles,
    });

    // "should return 403 if OPA returns they are not authorized"
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied: user is not authorized to view the admin page',
    });
  }

  adminLogger.info('Admin page access granted by OPA policy', {
    userSub: ctx.session.user.sub,
    roles: ctx.session.user.roles,
  });

  // "If they are, return a 200 with an empty response body for now."
  return {};
});
