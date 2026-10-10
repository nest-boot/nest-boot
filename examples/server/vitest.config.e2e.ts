import { createRequire } from 'node:module';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Use Node's GraphQL entry for scalar identity checks in externalized NestJS.
  resolve: {
    alias: [
      {
        find: /^graphql$/,
        replacement: createRequire(import.meta.url).resolve('graphql'),
      },
    ],
  },
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
