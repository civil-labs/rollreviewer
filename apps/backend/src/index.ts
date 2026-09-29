import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { env } from './config.js';
import { appRouter } from './router.js';
import { createContext } from './trpc.js';
import { healthRouter } from './routes/health.js';
import { authRestRouter } from './routes/auth.js';
import { mapRouter } from './routes/map.js';
import { logger } from './logger.js';

const app = new Hono();

logger.debug('Configuration loaded and validated', {
  nodeEnv: env.OC_RR_NODE_ENV,
  port: env.OC_RR_PORT,
  logLevel: env.OC_RR_LOG_LEVEL,
  oidcIssuer: env.OC_RR_OIDC_ISSUER,
  oidcTokenUrl: env.OC_RR_OIDC_TOKEN_URL ?? '(not set - using issuer)',
  oidcAuthUrl: env.OC_RR_OIDC_AUTH_URL ?? '(not set - using issuer)',
  oidcClientId: env.OC_RR_OIDC_CLIENT_ID,
  oidcRedirectUri: env.OC_RR_OIDC_REDIRECT_URI,
  oidcScopes: env.OC_RR_OIDC_SCOPES,
  valkeyUrl: env.OC_RR_VALKEY_URL,
});

// Mount REST routes
app.route('/api', healthRouter);
app.route('/api/auth', authRestRouter);
app.route('/api/map', mapRouter);

// Mount tRPC adapter handler via fetchRequestHandler on /api/trpc/*
app.all('/api/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: (opts) => createContext(opts, c),
  });
});

// Fallback error handler
app.onError((err, c) => {
  logger.error('Hono global unhandled error:', {
    error: err.message,
    name: err.name,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
  });
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

// Start Hono HTTP server using @hono/node-server
if (process.env.NODE_ENV !== 'test') {
  serve(
    {
      fetch: app.fetch,
      port: env.OC_RR_PORT,
    },
    (info) => {
      logger.info(`🚀 RollReviewer Backend listening on http://localhost:${info.port}`);
    }
  );
}

export { app };
