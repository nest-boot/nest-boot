import { resolve } from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    root: './',
    setupFiles: [
      resolve(import.meta.dirname, '../../vitest.setup.ts'),
      './vitest.setup.ts',
    ],
    include: ['src/**/*.spec.ts'],
  },
});
