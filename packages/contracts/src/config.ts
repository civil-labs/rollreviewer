import { z } from 'zod';

export const OC_RR_ConfigSchema = z.object({
  /** Node Environment */
  OC_RR_NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Server Port - automatically coerced from string */
  OC_RR_PORT: z.coerce.number().default(3001),

  /** OIDC OAuth Values */
  OC_RR_OIDC_ISSUER: z.string().url('OC_RR_OIDC_ISSUER must be a valid URL').default('http://localhost:8080/default'),
  OC_RR_OIDC_CLIENT_ID: z.string().min(1, 'OC_RR_OIDC_CLIENT_ID is required').default('rollreviewer-client'),
  OC_RR_OIDC_CLIENT_SECRET: z.string().min(1, 'OC_RR_OIDC_CLIENT_SECRET is required').default('rollreviewer-secret'),
  OC_RR_OIDC_REDIRECT_URI: z.string().url('OC_RR_OIDC_REDIRECT_URI must be a valid URL').default('http://localhost:3001/api/auth/callback'),
  OC_RR_OIDC_SCOPES: z.string().default('openid profile email'),

  /** Valkey Connection URL */
  OC_RR_VALKEY_URL: z.string().min(1, 'OC_RR_VALKEY_URL is required').default('redis://localhost:6379'),

  /** Basemap Proxy Endpoint */
  OC_RR_BASEMAP_URL: z.string().url('OC_RR_BASEMAP_URL must be a valid URL').default('https://demotiles.maplibre.org/style.json'),

  /** OpenPolicyAgent Endpoint */
  OC_RR_OPA_URL: z.string().url('OC_RR_OPA_URL must be a valid URL').default('http://localhost:8181'),
});

export type OC_RR_Config = z.infer<typeof OC_RR_ConfigSchema>;
