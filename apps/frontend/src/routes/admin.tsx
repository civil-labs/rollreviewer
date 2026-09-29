import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AdminPage } from '../pages/AdminPage.js';
import { trpc } from '../utils/trpc.js';
import { adminLogger } from '../utils/logger.js';

export const Route = createFileRoute('/admin')({
  component: AdminRouteComponent,
});

function AdminRouteComponent() {
  // Pre-render authorization check query to /api/trpc/getAdminPage
  const adminAuthQuery = trpc.getAdminPage.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Query authenticated user data
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (adminAuthQuery.isLoading) {
      adminLogger.debug('Initiating admin pre-render authorization check to /api/trpc/getAdminPage');
    } else if (adminAuthQuery.isError) {
      adminLogger.warn('Admin pre-render authorization check rejected; user is not eligible', {
        errorMessage: adminAuthQuery.error?.message,
        statusCode: adminAuthQuery.error?.data?.httpStatus,
      });
    } else if (adminAuthQuery.isSuccess) {
      adminLogger.info('Admin pre-render authorization check succeeded; user is eligible for admin panel');
    }
  }, [
    adminAuthQuery.isLoading,
    adminAuthQuery.isError,
    adminAuthQuery.isSuccess,
    adminAuthQuery.error,
  ]);

  const isLoading = adminAuthQuery.isLoading || meQuery.isLoading;
  const isAuthorized = adminAuthQuery.isSuccess;
  const userData = meQuery.data?.user ?? null;
  const errorMessage = adminAuthQuery.error?.message ?? null;

  return (
    <AdminPage
      isLoading={isLoading}
      isAuthorized={isAuthorized}
      userData={userData}
      error={errorMessage}
    />
  );
}
