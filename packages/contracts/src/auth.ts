import { z } from 'zod';

/**
 * Standard OIDC User Profile Claims Schema
 */
export const UserProfileSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  preferred_username: z.string().optional(),
  email_verified: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
  jurisdiction: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Response Schema for /api/trpc/auth.me
 */
export const AuthMeResponseSchema = z.object({
  isAuthenticated: z.boolean(),
  user: UserProfileSchema.nullable(),
  expiresAt: z.string().optional(),
});

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

/**
 * Response Schema for /api/trpc/auth.logout (empty object)
 */
export const AuthLogoutResponseSchema = z.object({});

export type AuthLogoutResponse = z.infer<typeof AuthLogoutResponseSchema>;
