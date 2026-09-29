import { describe, it, expect, vi } from 'vitest';
import * as oidc from 'openid-client';
import type { UserSessionData } from '../valkey.js';
import { sanitizeReturnTo, getOidcConfig, resetOidcConfig } from '../oidc.js';
import { extractUserProfile } from '../routes/auth.js';
import { OC_RR_ConfigSchema } from '@rollreviewer/contracts';
import { app } from '../index.js';

describe('BFF OIDC Helper Functions & Config Schema', () => {
  it('should enforce relative path redirects for returnTo URLs', () => {
    expect(sanitizeReturnTo('/admin')).toBe('/admin');
    expect(sanitizeReturnTo('/map?district=4')).toBe('/map?district=4');
    expect(sanitizeReturnTo('https://attacker.com')).toBe('/');
    expect(sanitizeReturnTo('//attacker.com')).toBe('/');
    expect(sanitizeReturnTo('/\\attacker.com')).toBe('/');
    expect(sanitizeReturnTo(null)).toBe('/');
  });

  it('should validate OC_RR_ConfigSchema environment variables with required issuer', () => {
    const validConfig = OC_RR_ConfigSchema.safeParse({
      OC_RR_NODE_ENV: 'test',
      OC_RR_PORT: '3001',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_OIDC_CLIENT_ID: 'test-client',
      OC_RR_OIDC_CLIENT_SECRET: 'test-secret',
      OC_RR_VALKEY_URL: 'redis://localhost:6379',
      OC_RR_BASEMAP_URL: 'https://demotiles.maplibre.org/style.json',
      OC_RR_OPA_URL: 'http://localhost:8181',
    });

    expect(validConfig.success).toBe(true);
    if (validConfig.success) {
      expect(validConfig.data.OC_RR_PORT).toBe(3001);
      expect(validConfig.data.OC_RR_OIDC_ISSUER).toBe('http://localhost:8080/default');
      expect(validConfig.data.OC_RR_OIDC_TOKEN_URL).toBeUndefined();
      expect(validConfig.data.OC_RR_OIDC_AUTH_URL).toBeUndefined();
      expect(validConfig.data.OC_RR_LOG_LEVEL).toBe('debug');
    }
  });

  it('should parse and normalize OC_RR_LOG_LEVEL or reject invalid values', () => {
    const customConfig = OC_RR_ConfigSchema.safeParse({
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_LOG_LEVEL: 'WARN',
    });
    expect(customConfig.success).toBe(true);
    if (customConfig.success) {
      expect(customConfig.data.OC_RR_LOG_LEVEL).toBe('warn');
    }

    const invalidLevel = OC_RR_ConfigSchema.safeParse({
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_LOG_LEVEL: 'nonexistent',
    });
    expect(invalidLevel.success).toBe(false);
  });

  it('should fail fast when OC_RR_OIDC_ISSUER is missing from config schema', () => {
    const invalidConfig = OC_RR_ConfigSchema.safeParse({
      OC_RR_NODE_ENV: 'test',
      OC_RR_PORT: '3001',
      OC_RR_OIDC_CLIENT_ID: 'test-client',
      OC_RR_OIDC_CLIENT_SECRET: 'test-secret',
      OC_RR_VALKEY_URL: 'redis://localhost:6379',
      OC_RR_BASEMAP_URL: 'https://demotiles.maplibre.org/style.json',
      OC_RR_OPA_URL: 'http://localhost:8181',
    });

    expect(invalidConfig.success).toBe(false);
    if (!invalidConfig.success) {
      const issuerError = invalidConfig.error.issues.find(
        (issue) => issue.path.includes('OC_RR_OIDC_ISSUER')
      );
      expect(issuerError).toBeDefined();
    }
  });

  it('should accept the 3 distinct auth URLs in config schema without default values', () => {
    const splitConfig = OC_RR_ConfigSchema.safeParse({
      OC_RR_NODE_ENV: 'test',
      OC_RR_PORT: '3001',
      OC_RR_OIDC_ISSUER: 'https://auth.company.gov/default',
      OC_RR_OIDC_TOKEN_URL: 'http://auth-service.auth.svc.cluster.local:8080/default',
      OC_RR_OIDC_AUTH_URL: 'https://login.company.gov/default',
      OC_RR_OIDC_CLIENT_ID: 'test-client',
      OC_RR_OIDC_CLIENT_SECRET: 'test-secret',
      OC_RR_VALKEY_URL: 'redis://localhost:6379',
      OC_RR_BASEMAP_URL: 'https://demotiles.maplibre.org/style.json',
      OC_RR_OPA_URL: 'http://localhost:8181',
    });

    expect(splitConfig.success).toBe(true);
    if (splitConfig.success) {
      expect(splitConfig.data.OC_RR_OIDC_ISSUER).toBe('https://auth.company.gov/default');
      expect(splitConfig.data.OC_RR_OIDC_TOKEN_URL).toBe('http://auth-service.auth.svc.cluster.local:8080/default');
      expect(splitConfig.data.OC_RR_OIDC_AUTH_URL).toBe('https://login.company.gov/default');
    }
  });

  it('should fallback token and auth endpoints to issuer url if not set', async () => {
    resetOidcConfig();
    const config = await getOidcConfig({
      OC_RR_NODE_ENV: 'development',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_OIDC_TOKEN_URL: undefined,
      OC_RR_OIDC_AUTH_URL: undefined,
    });

    const metadata = config.serverMetadata();
    expect(metadata.issuer).toBe('http://localhost:8080/default');
    expect(metadata.authorization_endpoint).toBe('http://localhost:8080/default/authorize');
    expect(metadata.token_endpoint).toBe('http://localhost:8080/default/token');
    // When token URL is not set separately from issuer, customFetch should not be attached
    expect((config as any)[oidc.customFetch]).toBeUndefined();
  });

  it('should use individual token and auth urls when set for their given task', async () => {
    resetOidcConfig();
    const config = await getOidcConfig({
      OC_RR_NODE_ENV: 'development',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_OIDC_TOKEN_URL: 'http://mock-oauth.local:8080/default',
      OC_RR_OIDC_AUTH_URL: 'http://auth.public.gov/default',
    });

    const metadata = config.serverMetadata();
    expect(metadata.issuer).toBe('http://localhost:8080/default');
    expect(metadata.authorization_endpoint).toBe('http://auth.public.gov/default/authorize');
    expect(metadata.token_endpoint).toBe('http://mock-oauth.local:8080/default/token');
  });

  it('should enforce allowInsecureRequests only when non-production and auth url is http', async () => {
    // 1. Non-production + HTTP auth URL => Insecure allowed (tlsOnly = false)
    const devHttpConfig = await getOidcConfig({
      OC_RR_NODE_ENV: 'development',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_OIDC_AUTH_URL: 'http://localhost:8080/default',
    });
    // With insecure requests allowed, buildAuthorizationUrl succeeds with http:
    expect(() =>
      oidc.buildAuthorizationUrl(devHttpConfig, { redirect_uri: 'http://localhost:3000/cb' })
    ).not.toThrow();

    // 2. Production + HTTP auth URL => Insecure NOT allowed (strict HTTPS enforcement)
    const prodHttpConfig = await getOidcConfig({
      OC_RR_NODE_ENV: 'production',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
      OC_RR_OIDC_AUTH_URL: 'http://localhost:8080/default',
    });
    expect(() =>
      oidc.buildAuthorizationUrl(prodHttpConfig, { redirect_uri: 'https://app.gov/cb' })
    ).toThrow(/only requests to HTTPS are allowed/);

    // 3. Non-production + HTTPS auth URL => Insecure NOT allowed
    const devHttpsConfig = await getOidcConfig({
      OC_RR_NODE_ENV: 'development',
      OC_RR_OIDC_ISSUER: 'https://auth.company.gov/default',
      OC_RR_OIDC_AUTH_URL: 'https://auth.company.gov/default',
    });
    // With HTTPS, strict TLS is maintained
    expect(() =>
      oidc.buildAuthorizationUrl(devHttpsConfig, { redirect_uri: 'https://app.gov/cb' })
    ).not.toThrow();
  });

  it('should use custom fetch to downgrade connection from https to http for token endpoint when set separately', async () => {
    resetOidcConfig();
    const config = await getOidcConfig({
      OC_RR_NODE_ENV: 'development',
      OC_RR_OIDC_ISSUER: 'https://auth.company.gov/default',
      OC_RR_OIDC_TOKEN_URL: 'http://auth-service.auth.svc.cluster.local:8080/default',
      OC_RR_OIDC_AUTH_URL: 'https://auth.company.gov/default',
    });

    const customFetchFn = (config as any)[oidc.customFetch];
    expect(customFetchFn).toBeDefined();

    // Mock global fetch to verify intercepted URL
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    try {
      await customFetchFn('https://auth-service.auth.svc.cluster.local:8080/default/token', {});
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestedUrl = fetchMock.mock.calls[0][0];
      // Protocol downgraded from https to http
      expect(requestedUrl).toBe('http://auth-service.auth.svc.cluster.local:8080/default/token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should not set token or auth url to discovered version if environment variables are set', async () => {
    resetOidcConfig();

    const originalFetch = globalThis.fetch;
    const mockDiscoveryResponse = {
      issuer: 'http://localhost:8080/default',
      authorization_endpoint: 'http://discovered-auth.internal/custom/authorize',
      token_endpoint: 'http://discovered-token.internal/custom/token',
      jwks_uri: 'http://discovered-token.internal/custom/jwks',
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockDiscoveryResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    try {
      // 1. Both env vars are set -> discovery endpoints must NOT override them
      const configWithEnvs = await getOidcConfig({
        OC_RR_NODE_ENV: 'development',
        OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
        OC_RR_OIDC_AUTH_URL: 'http://env-auth.public.gov/default/authorize',
        OC_RR_OIDC_TOKEN_URL: 'http://env-token.internal:8080/default/token',
      });

      const metaWithEnvs = configWithEnvs.serverMetadata();
      expect(metaWithEnvs.authorization_endpoint).toBe('http://env-auth.public.gov/default/authorize');
      expect(metaWithEnvs.token_endpoint).toBe('http://env-token.internal:8080/default/token');

      // 2. Both env vars are NOT set -> discovery endpoints SHOULD be used
      const configWithoutEnvs = await getOidcConfig({
        OC_RR_NODE_ENV: 'development',
        OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
        OC_RR_OIDC_AUTH_URL: undefined,
        OC_RR_OIDC_TOKEN_URL: undefined,
      });

      const metaWithoutEnvs = configWithoutEnvs.serverMetadata();
      expect(metaWithoutEnvs.authorization_endpoint).toBe('http://discovered-auth.internal/custom/authorize');
      expect(metaWithoutEnvs.token_endpoint).toBe('http://discovered-token.internal/custom/token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should reject unauthenticated requests to /api/map with 401 Unauthorized', async () => {
    const res = await app.request('/api/map/style.json');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should extract user claims without injecting default test roles or values', () => {
    const clean = extractUserProfile({ sub: 'real-user-id' });
    expect(clean.sub).toBe('real-user-id');
    expect(clean.roles).toEqual([]);
    expect(clean.name).toBeUndefined();
    expect(clean.email).toBeUndefined();
    expect(clean.jurisdiction).toBeUndefined();

    const populated = extractUserProfile({
      sub: 'admin-1',
      roles: ['Admin', 'Assessor'],
      email: 'admin@county.gov',
      jurisdiction: 'County-Wide',
      preferred_username: 'countyadmin',
      email_verified: true,
    });
    expect(populated.sub).toBe('admin-1');
    expect(populated.roles).toEqual(['Admin', 'Assessor']);
    expect(populated.email).toBe('admin@county.gov');
    expect(populated.jurisdiction).toBe('County-Wide');
    expect(populated.preferred_username).toBe('countyadmin');
    expect(populated.email_verified).toBe(true);

    const stringRole = extractUserProfile({
      sub: 'user-2',
      roles: 'SingleRole',
    });
    expect(stringRole.roles).toEqual(['SingleRole']);

    const groupsRole = extractUserProfile({
      sub: 'user-3',
      groups: ['GroupA', 'GroupB'],
    });
    expect(groupsRole.roles).toEqual(['GroupA', 'GroupB']);
  });
});
