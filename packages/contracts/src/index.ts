import { z } from 'zod';

export const AuthLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;
