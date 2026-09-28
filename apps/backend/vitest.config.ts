import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      OC_RR_NODE_ENV: 'test',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
    },
    exclude: ['dist/**', 'node_modules/**'],
  },
});
