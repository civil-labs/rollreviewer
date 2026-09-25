import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { env } from '../config.js';
import { getSession } from '../valkey.js';

export const mapRouter = new Hono();

/**
 * GET /api/map/*
 * Proxies basemap and tile requests to OC_RR_BASEMAP_URL with user access token attached.
 * Rejects requests with 401 Unauthorized if the user does not have a valid session.
 */
mapRouter.all('/*', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    return c.json({ error: 'Unauthorized', message: 'Authentication session required' }, 401);
  }

  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired session' }, 401);
  }

  const accessToken = session.accessToken;

  // Construct proxy target URL
  const path = c.req.path.replace(/^\/api\/map/, '');
  const targetUrl = new URL(path || '/', env.OC_RR_BASEMAP_URL);

  const headers = new Headers(c.req.raw.headers);
  headers.set('Host', targetUrl.host);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    });

    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  } catch (err) {
    console.warn(`Map proxy request to ${targetUrl} failed:`, err);
    // Fallback JSON for demo/mock basemap
    return c.json({
      version: 8,
      name: 'Fallback Vector Basemap',
      sources: {},
      layers: [],
    });
  }
});
