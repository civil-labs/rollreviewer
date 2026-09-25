import { describe, it, expect } from 'vitest';
import { sanitizeReturnTo } from '../oidc.js';
import { OC_RR_ConfigSchema } from '@rollreviewer/contracts';
import { app } from '../index.js';

describe('BFF OIDC Helper Functions', () => {
  it('should enforce relative path redirects for returnTo URLs', () => {
    expect(sanitizeReturnTo('/admin')).toBe('/admin');
    expect(sanitizeReturnTo('/map?district=4')).toBe('/map?district=4');
    expect(sanitizeReturnTo('https://attacker.com')).toBe('/');
    expect(sanitizeReturnTo('//attacker.com')).toBe('/');
    expect(sanitizeReturnTo('/\\attacker.com')).toBe('/');
    expect(sanitizeReturnTo(null)).toBe('/');
  });

  it('should validate OC_RR_ConfigSchema environment variables', () => {
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
    }
  });

  it('should reject unauthenticated requests to /api/map with 401 Unauthorized', async () => {
    const res = await app.request('/api/map/style.json');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });
});
