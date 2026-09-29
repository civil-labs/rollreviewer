import React from 'react';

export interface AdminPageProps {
  isLoading: boolean;
  isAuthorized: boolean;
  userData?: Record<string, unknown> | null;
  error?: string | null;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  isLoading,
  isAuthorized,
  userData,
  error,
}) => {
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
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
        }}
      >
        {isLoading ? (
          <div>
            <h2 style={{ margin: '0 0 16px 0', color: '#38bdf8' }}>⚙️ Admin Panel</h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#94a3b8',
                fontSize: '15px',
                padding: '12px 0',
              }}
            >
              <span>Verifying admin authorization...</span>
            </div>
          </div>
        ) : !isAuthorized ? (
          <div>
            <h2 style={{ margin: '0 0 16px 0', color: '#ef4444' }}>🚫 Access Denied</h2>
            <p style={{ color: '#f87171', lineHeight: 1.6, margin: '0 0 12px 0', fontSize: '15px' }}>
              You are not eligible to access the Admin Panel.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
              {error || 'Authorization was rejected by Open Policy Agent.'}
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#38bdf8' }}>⚙️ Admin Panel</h2>
              <span
                style={{
                  background: '#064e3b',
                  color: '#34d399',
                  border: '1px solid #059669',
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Access Granted
              </span>
            </div>

            <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px 0', fontSize: '14px' }}>
              You have been verified as eligible to view the Admin Panel.
            </p>

            <h4 style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Backend User Data:
            </h4>
            <pre
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '16px',
                color: '#38bdf8',
                fontSize: '13px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {JSON.stringify(userData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
