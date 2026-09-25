import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root.js';
import { AdminPage } from '../pages/AdminPage.js';
import { trpc } from '../utils/trpc.js';

export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminRouteComponent,
});

function AdminRouteComponent() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return <AdminPage user={meQuery.data?.user} />;
}
