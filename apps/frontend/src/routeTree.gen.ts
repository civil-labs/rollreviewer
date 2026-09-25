import { rootRoute } from './routes/__root.js';
import { indexRoute } from './routes/index.js';
import { adminRoute } from './routes/admin.js';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute,
]);
