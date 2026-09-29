import { OC_RR_ConfigSchema } from '@rollreviewer/contracts';

const result = OC_RR_ConfigSchema.safeParse(process.env);

if (!result.success) {
  const formattedErrors = result.error.flatten().fieldErrors;
  console.error('❌ FATAL: Missing or invalid environment variables:', formattedErrors);
  throw new Error(`Missing or invalid environment variables: ${Object.keys(formattedErrors).join(', ')}`);
}

export const env = result.data;
