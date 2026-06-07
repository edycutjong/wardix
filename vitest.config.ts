import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    exclude: ['node_modules', 'e2e/**', 'demo/**'],
    env: {
      T3N_SANDBOX_TOKEN: 'test-sandbox-token-00000000000000000000000000000'
    },
    coverage: {
      include: ['src/**'],
      exclude: [
        'src/app/globals.css',
        'src/data/db.json',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/lib/__tests__/**'
      ]
    },
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
