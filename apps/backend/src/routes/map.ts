import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { env } from '../config.js';
import { getSession } from '../valkey.js';
import { mapLogger } from '../logger.js';

export const mapRouter = new Hono();

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'cookie',
  'content-length',
]);

/**
 * Resolves the destination URL for proxied basemap / tile requests.
 */
export function resolveTargetUrl(reqPath: string, reqUrl: string, basemapUrl: string): URL {
  const base = new URL(basemapUrl);
  const path = reqPath.replace(/^\/api\/map/, '');

  let target: URL;
  if (!path || path === '/' || path === '/style.json') {
    target = new URL(base.toString());
  } else {
    const relativePath = path.startsWith('/') ? path.slice(1) : path;
    target = new URL(relativePath, base);
  }

  try {
    const incoming = new URL(reqUrl);
    if (incoming.search) {
      target.search = incoming.search;
    }
  } catch {
    // If reqUrl is relative or malformed, skip copying search params
  }

  return target;
}

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
  const targetUrl = resolveTargetUrl(c.req.path, c.req.url, env.OC_RR_BASEMAP_URL);

  // Filter out hop-by-hop headers from client request
  const outgoingHeaders = new Headers();
  for (const [key, value] of c.req.raw.headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      outgoingHeaders.set(key, value);
    }
  }

  if (accessToken) {
    outgoingHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  mapLogger.debug('Proxying map request', {
    targetUrl: targetUrl.toString(),
    method: c.req.method,
  });

  try {
    const res = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers: outgoingHeaders,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    });

    // Filter out hop-by-hop and encoding headers from upstream response
    // Node.js fetch() auto-decompresses the stream, so content-encoding and content-length must not be forwarded
    const responseHeaders = new Headers();
    for (const [key, value] of res.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (
        !HOP_BY_HOP_HEADERS.has(lowerKey) &&
        lowerKey !== 'content-encoding' &&
        lowerKey !== 'content-length'
      ) {
        responseHeaders.set(key, value);
      }
    }

    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    mapLogger.error(`Map proxy request to ${targetUrl} failed:`, {
      targetUrl: targetUrl.toString(),
      error: (err as Error).message,
      stack: (err as Error).stack,
    });

    // Fallback JSON for demo/mock basemap
    return c.json({
      version: 8,
      name: 'Fallback Vector Basemap',
      sources: {},
      layers: [],
    });
  }
});
