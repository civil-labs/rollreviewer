import { OPAClient } from '@open-policy-agent/opa';
import { env } from './config.js';
import { opaLogger } from './logger.js';

export const opaClient = new OPAClient(env.OC_RR_OPA_URL);

export interface AuthzInput {
  user: {
    sub: string;
    roles: string[];
    jurisdiction?: string;
  };
  action: string;
  resource?: Record<string, unknown>;
}

/**
 * Evaluate authorization policy using official OpenPolicyAgent Node.js SDK.
 * Throws an error if OPA server is not contactable so caller can proceed as unauthorized.
 */
export async function evaluatePolicy(path: string, input: AuthzInput): Promise<boolean> {
  opaLogger.debug('Evaluating OPA authorization policy', {
    path,
    userSub: input.user?.sub,
    roles: input.user?.roles,
    action: input.action,
    opaUrl: env.OC_RR_OPA_URL,
  });

  try {
    const result = await opaClient.evaluate(path, input);
    opaLogger.debug('OPA policy evaluation completed', {
      path,
      result,
    });

    if (typeof result === 'boolean') {
      return result;
    }
    if (result && typeof result === 'object') {
      if ('allow' in result) {
        return Boolean((result as { allow: unknown }).allow);
      }
      if ('authorized' in result) {
        return Boolean((result as { authorized: unknown }).authorized);
      }
    }
    return Boolean(result);
  } catch (error) {
    opaLogger.error(`OPA server is not contactable for path "${path}" at ${env.OC_RR_OPA_URL}`, {
      path,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    // Throw error when OPA is not contactable so the caller knows it failed
    throw error;
  }
}

/**
 * Convenience helper to evaluate admin page authorization via OPA
 */
export async function checkAdminAuthorization(user: {
  sub: string;
  roles: string[];
  jurisdiction?: string;
}): Promise<boolean> {
  const input: AuthzInput = {
    user,
    action: 'view_admin_page',
    resource: { page: 'admin' },
  };

  return evaluatePolicy('rollreviewer/authz/allow', input);
}
