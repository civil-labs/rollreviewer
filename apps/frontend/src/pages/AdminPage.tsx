import React from 'react';

interface AdminPageProps {
  user?: {
    name?: string;
    email?: string;
    roles?: string[];
    jurisdiction?: string;
  } | null;
}

export const AdminPage: React.FC<AdminPageProps> = ({ user }) => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ margin: '0 0 16px 0', color: '#38bdf8' }}>⚙️ Admin Panel</h2>
        <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
          Welcome to the RollReviewer Admin Portal. This page is protected by authentication.
        </p>

        {user && (
          <div
            style={{
              background: '#0f172a',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '20px',
              fontSize: '14px',
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>User:</strong> {user.name} ({user.email})
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Roles:</strong> {user.roles?.join(', ') || 'Assessor'}
            </div>
            <div>
              <strong>Jurisdiction:</strong> {user.jurisdiction || 'District-4'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
