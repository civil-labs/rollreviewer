import React, { useState } from 'react';
import { trpc } from '../utils/trpc.js';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  user?: {
    name?: string;
    email?: string;
    roles?: string[];
  } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, user }) => {
  const [isOpen, setIsOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/api/auth/login';
    },
    onError: () => {
      // Fallback redirect if session already expired
      window.location.href = '/api/auth/login';
    },
  });

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logoutMutation.mutate();
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1000,
          background: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '8px 14px',
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        {isOpen ? '✕ Close Menu' : '☰ Menu'}
      </button>

      {/* Pop-out Sidebar overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 998,
          }}
        />
      )}

      {/* Sidebar Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '260px',
          background: '#0f172a',
          color: '#f8fafc',
          zIndex: 999,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 20px 20px 20px',
          boxShadow: '4px 0 16px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 6px 0', color: '#38bdf8', fontSize: '18px' }}>RollReviewer</h3>
          {user && (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              <div><strong>{user.name || 'Assessor'}</strong></div>
              <div>{user.email}</div>
            </div>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <button
            onClick={() => {
              onNavigate('/');
              setIsOpen(false);
            }}
            style={{
              padding: '12px 16px',
              textAlign: 'left',
              background: currentPath === '/' ? '#0284c7' : 'transparent',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🗺️ Map
          </button>

          <button
            onClick={() => {
              onNavigate('/admin');
              setIsOpen(false);
            }}
            style={{
              padding: '12px 16px',
              textAlign: 'left',
              background: currentPath === '/admin' ? '#0284c7' : 'transparent',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⚙️ Admin
          </button>

          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            style={{
              marginTop: 'auto',
              padding: '12px 16px',
              textAlign: 'left',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🚪 {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </button>
        </nav>
      </div>
    </>
  );
};
