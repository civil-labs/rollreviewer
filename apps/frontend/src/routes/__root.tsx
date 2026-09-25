import { useEffect } from 'react';
import { createRootRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { Sidebar } from '../components/Sidebar.js';
import { trpc } from '../utils/trpc.js';

export const rootRoute = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Query authentication state
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Protect all routes: if unauthenticated, redirect to OIDC login
  useEffect(() => {
    if (meQuery.isFetched && (!meQuery.data || !meQuery.data.isAuthenticated)) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      window.location.href = `/api/auth/login?returnTo=${returnTo}`;
    }
  }, [meQuery.isFetched, meQuery.data, location.pathname, location.search]);

  if (meQuery.isLoading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#0f172a',
          color: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Authenticating RollReviewer Session...
      </div>
    );
  }

  const user = meQuery.data?.user;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Sidebar
        currentPath={location.pathname}
        onNavigate={(path) => navigate({ to: path })}
        user={user}
      />
      <Outlet />
    </div>
  );
}
