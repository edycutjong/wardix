import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['node_modules', 'e2e/**', 'demo/**'],
    env: {
      T3N_SANDBOX_TOKEN: 'test-sandbox-token-00000000000000000000000000000'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
