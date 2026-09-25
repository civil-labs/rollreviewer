import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { env } from './config.js';
import { appRouter } from './router.js';
import { createContext } from './trpc.js';
import { healthRouter } from './routes/health.js';
import { authRestRouter } from './routes/auth.js';
import { mapRouter } from './routes/map.js';

const app = new Hono();

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
  console.error('Hono Global Error:', err);
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
      console.log(`🚀 RollReviewer Backend listening on http://localhost:${info.port}`);
    }
  );
}

export { app };
