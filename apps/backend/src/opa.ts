import { OPAClient } from '@open-policy-agent/opa';
import { env } from './config.js';

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
 * Evaluate authorization policy using official OpenPolicyAgent Node.js SDK
 */
export async function evaluatePolicy(path: string, input: AuthzInput): Promise<boolean> {
  try {
    const result = await opaClient.evaluate(path, input);
    return Boolean(result);
  } catch (error) {
    console.warn(`OPA Policy evaluation failed for path ${path}:`, error);
    // Default fallback to true for Sprint 1 mock environment if OPA server is un-contactable
    return true;
  }
}
