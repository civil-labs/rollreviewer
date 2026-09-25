import { OC_RR_ConfigSchema } from '@rollreviewer/contracts';

const result = OC_RR_ConfigSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ FATAL: Missing or invalid environment variables:');
  const formattedErrors = result.error.flatten().fieldErrors;
  for (const [field, errors] of Object.entries(formattedErrors)) {
    console.error(`  - ${field}: ${errors?.join(', ')}`);
  }
  // If running in test mode without required envs, fallback to defaults or fail
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = result.success
  ? result.data
  : OC_RR_ConfigSchema.parse({});
