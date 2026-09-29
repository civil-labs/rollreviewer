import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as valkey from '../valkey.js';
import * as opaModule from '../opa.js';
import { app } from '../index.js';

describe('Admin Authorization Route (/api/trpc/getAdminPage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUserSession: valkey.UserSessionData = {
    sessionId: 'test-admin-session',
    user: {
      sub: 'user_123',
      name: 'Test Assessor',
      email: 'assessor@county.gov',
      roles: ['Assessor'],
      jurisdiction: 'District-4',
    },
    accessToken: 'test-access-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };

  it('should return 403 Forbidden when no session cookie is present', async () => {
    const res = await app.request('/api/trpc/getAdminPage');
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain('Access denied');
  });

  it('should return 403 Forbidden when session in Valkey is invalid or expired', async () => {
    vi.spyOn(valkey, 'getSession').mockResolvedValue(null);

    const res = await app.request('/api/trpc/getAdminPage', {
      headers: {
        Cookie: 'session_id=invalid-session-id',
      },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain('Access denied');
  });

  it('should return 403 Forbidden when OPA policy evaluates user as not authorized', async () => {
    vi.spyOn(valkey, 'getSession').mockResolvedValue(mockUserSession);
    vi.spyOn(opaModule.opaClient, 'evaluate').mockResolvedValue(false);

    const res = await app.request('/api/trpc/getAdminPage', {
      headers: {
        Cookie: 'session_id=test-admin-session',
      },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain('not authorized to view the admin page');
  });

  it('should return 200 with an empty object when OPA policy authorizes the user', async () => {
    vi.spyOn(valkey, 'getSession').mockResolvedValue(mockUserSession);
    vi.spyOn(opaModule.opaClient, 'evaluate').mockResolvedValue(true);

    const res = await app.request('/api/trpc/getAdminPage', {
      headers: {
        Cookie: 'session_id=test-admin-session',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.data).toEqual({});
  });

  it('should return 403 Forbidden when OPA returns an object with allow: true', async () => {
    vi.spyOn(valkey, 'getSession').mockResolvedValue(mockUserSession);
    vi.spyOn(opaModule.opaClient, 'evaluate').mockResolvedValue({ allow: true } as any);

    const res = await app.request('/api/trpc/getAdminPage', {
      headers: {
        Cookie: 'session_id=test-admin-session',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.data).toEqual({});
  });

  it('should throw an error, log, and proceed as unauthorized (403) when OPA is not contactable', async () => {
    vi.spyOn(valkey, 'getSession').mockResolvedValue(mockUserSession);
    vi.spyOn(opaModule.opaClient, 'evaluate').mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:8181')
    );

    const res = await app.request('/api/trpc/getAdminPage', {
      headers: {
        Cookie: 'session_id=test-admin-session',
      },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain('authorization service unavailable');
  });
});
