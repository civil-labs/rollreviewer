import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './utils/trpc.js';
import { Sidebar } from './components/Sidebar.js';
import { MapPage } from './pages/MapPage.js';
import { AdminPage } from './pages/AdminPage.js';

const AppContent: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  // Listen to browser popstate for history navigation
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Auth Session Query
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Protect pages: if unauthenticated, redirect to /api/auth/login?returnTo=...
  useEffect(() => {
    if (meQuery.isFetched && (!meQuery.data || !meQuery.data.isAuthenticated)) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/api/auth/login?returnTo=${returnTo}`;
    }
  }, [meQuery.isFetched, meQuery.data]);

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
      <Sidebar currentPath={currentPath} onNavigate={navigate} user={user} />
      {currentPath === '/admin' ? <AdminPage user={user} /> : <MapPage />}
    </div>
  );
};

export const App: React.FC = () => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  );
};

export default App;
