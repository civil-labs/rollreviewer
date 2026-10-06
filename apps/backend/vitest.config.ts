import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    env: {
      OC_RR_NODE_ENV: 'test',
      OC_RR_OIDC_ISSUER: 'http://localhost:8080/default',
    },
    exclude: ['dist/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@rollreviewer/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
});
