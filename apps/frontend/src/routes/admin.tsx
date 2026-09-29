import { createFileRoute } from '@tanstack/react-router';
import { AdminPage } from '../pages/AdminPage.js';
import { trpc } from '../utils/trpc.js';

export const Route = createFileRoute('/admin')({
  component: AdminRouteComponent,
});

function AdminRouteComponent() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return <AdminPage user={meQuery.data?.user} />;
}
