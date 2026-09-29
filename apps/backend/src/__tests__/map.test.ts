import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTargetUrl, mapRouter } from '../routes/map.js';
import * as valkey from '../valkey.js';
import { Hono } from 'hono';

describe('Map Proxy Route & URL Resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveTargetUrl', () => {
    const basemapUrl = 'https://demotiles.maplibre.org/style.json';

    it('should resolve /api/map to the basemap URL', () => {
      const url = resolveTargetUrl('/api/map', 'http://localhost:3001/api/map', basemapUrl);
      expect(url.toString()).toBe('https://demotiles.maplibre.org/style.json');
    });

    it('should resolve /api/map/ to the basemap URL', () => {
      const url = resolveTargetUrl('/api/map/', 'http://localhost:3001/api/map/', basemapUrl);
      expect(url.toString()).toBe('https://demotiles.maplibre.org/style.json');
    });

    it('should resolve /api/map/style.json to the basemap URL', () => {
      const url = resolveTargetUrl(
        '/api/map/style.json',
        'http://localhost:3001/api/map/style.json',
        basemapUrl
      );
      expect(url.toString()).toBe('https://demotiles.maplibre.org/style.json');
    });

    it('should resolve relative tile paths against the basemap URL', () => {
      const url = resolveTargetUrl(
        '/api/map/tiles/tiles.json',
        'http://localhost:3001/api/map/tiles/tiles.json',
        basemapUrl
      );
      expect(url.toString()).toBe('https://demotiles.maplibre.org/tiles/tiles.json');
    });

    it('should preserve query parameters from incoming request', () => {
      const url = resolveTargetUrl(
        '/api/map/tiles/1/2/3.pbf',
        'http://localhost:3001/api/map/tiles/1/2/3.pbf?key=secret&v=2',
        basemapUrl
      );
      expect(url.toString()).toBe('https://demotiles.maplibre.org/tiles/1/2/3.pbf?key=secret&v=2');
    });
  });

  describe('mapRouter HTTP handler', () => {
    const testApp = new Hono();
    testApp.route('/api/map', mapRouter);

    it('should return 401 Unauthorized if no session_id cookie is present', async () => {
      const res = await testApp.request('/api/map/style.json');
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 Unauthorized if session is invalid or expired in Valkey', async () => {
      vi.spyOn(valkey, 'getSession').mockResolvedValue(null);

      const res = await testApp.request('/api/map/style.json', {
        headers: {
          Cookie: 'session_id=invalid-or-expired',
        },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should strip connection: upgrade and hop-by-hop headers before fetching upstream', async () => {
      vi.spyOn(valkey, 'getSession').mockResolvedValue({
        sessionId: 'valid-session',
        user: {
          sub: 'user-1',
          email: 'user@example.com',
          roles: ['user'],
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      let capturedHeaders: Headers | undefined;
      let capturedUrl: string | undefined;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        capturedUrl = input.toString();
        capturedHeaders = init?.headers as Headers;
        return new Response(JSON.stringify({ version: 8, name: 'Test Style' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-encoding': 'gzip',
            'content-length': '123',
            connection: 'keep-alive',
          },
        });
      });

      const res = await testApp.request('/api/map/style.json', {
        headers: {
          Cookie: 'session_id=valid-session',
          Connection: 'upgrade',
          Upgrade: 'websocket',
          Host: 'localhost:3000',
        },
      });

      expect(res.status).toBe(200);
      expect(capturedUrl).toBe('https://demotiles.maplibre.org/style.json');
      expect(capturedHeaders).toBeDefined();

      // Hop-by-hop headers should NOT have been forwarded
      expect(capturedHeaders?.get('connection')).toBeNull();
      expect(capturedHeaders?.get('upgrade')).toBeNull();
      expect(capturedHeaders?.get('cookie')).toBeNull();

      // Authorization header should be set with the session access token
      expect(capturedHeaders?.get('authorization')).toBe('Bearer mock-access-token');

      // Response headers should NOT contain content-encoding or content-length or connection
      expect(res.headers.get('content-encoding')).toBeNull();
      expect(res.headers.get('content-length')).toBeNull();
      expect(res.headers.get('connection')).toBeNull();
      expect(res.headers.get('content-type')).toBe('application/json');

      const body = await res.json();
      expect(body.name).toBe('Test Style');
    });

    it('should return fallback vector basemap if upstream fetch fails', async () => {
      vi.spyOn(valkey, 'getSession').mockResolvedValue({
        sessionId: 'valid-session',
        user: {
          sub: 'user-1',
          email: 'user@example.com',
          roles: ['user'],
        },
        accessToken: 'mock-access-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

      const res = await testApp.request('/api/map/style.json', {
        headers: {
          Cookie: 'session_id=valid-session',
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Fallback Vector Basemap');
      expect(data.version).toBe(8);
    });
  });
});
