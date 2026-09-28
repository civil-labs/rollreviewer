import { z } from 'zod';

export const LogLevelSchema = z.enum([
  'silly',
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
]);

export type LogLevel = z.infer<typeof LogLevelSchema>;

export const OC_RR_ConfigSchema = z.object({
  /** Node Environment */
  OC_RR_NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Server Port - automatically coerced from string */
  OC_RR_PORT: z.coerce.number().default(3001),

  /** Log Level - defaults to 'debug', case-insensitive, supports LOG_LEVEL fallback */
  OC_RR_LOG_LEVEL: z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() !== '') return val.toLowerCase();
    const envObj = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (envObj?.LOG_LEVEL) {
      return envObj.LOG_LEVEL.toLowerCase();
    }
    return undefined;
  }, LogLevelSchema.default('debug')),

  /** OIDC OAuth Values */
  /** Public Issuer URL (canonical issuer, validated in ID tokens) - REQUIRED */
  OC_RR_OIDC_ISSUER: z.url('OC_RR_OIDC_ISSUER must be a valid URL'),
  /** Internal location for backend backchannel token swap and JWKS - OPTIONAL */
  OC_RR_OIDC_TOKEN_URL: z.url('OC_RR_OIDC_TOKEN_URL must be a valid URL').optional().or(z.literal('').transform(() => undefined)),
  /** Browser redirect URL for authorization login - OPTIONAL */
  OC_RR_OIDC_AUTH_URL: z.url('OC_RR_OIDC_AUTH_URL must be a valid URL').optional().or(z.literal('').transform(() => undefined)),
  OC_RR_OIDC_CLIENT_ID: z.string().min(1, 'OC_RR_OIDC_CLIENT_ID is required').default('rollreviewer-client'),
  OC_RR_OIDC_CLIENT_SECRET: z.string().min(1, 'OC_RR_OIDC_CLIENT_SECRET is required').default('rollreviewer-secret'),
  OC_RR_OIDC_REDIRECT_URI: z.url('OC_RR_OIDC_REDIRECT_URI must be a valid URL').default('http://localhost:3001/api/auth/callback'),
  OC_RR_OIDC_SCOPES: z.string().default('openid profile email'),

  /** Valkey Connection URL */
  OC_RR_VALKEY_URL: z.string().min(1, 'OC_RR_VALKEY_URL is required').default('redis://localhost:6379'),

  /** Basemap Proxy Endpoint */
  OC_RR_BASEMAP_URL: z.string().url('OC_RR_BASEMAP_URL must be a valid URL').default('https://demotiles.maplibre.org/style.json'),

  /** OpenPolicyAgent Endpoint */
  OC_RR_OPA_URL: z.string().url('OC_RR_OPA_URL must be a valid URL').default('http://localhost:8181'),
});

export type OC_RR_Config = z.infer<typeof OC_RR_ConfigSchema>;
