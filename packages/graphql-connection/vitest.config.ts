import { resolve } from "node:path";

import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2023",
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@nest-boot/auth",
        replacement: resolve(import.meta.dirname, "../auth/src/index.js"),
      },
      {
        find: "@nest-boot/bullmq",
        replacement: resolve(import.meta.dirname, "../bullmq/src/index.js"),
      },
      {
        find: "@nest-boot/bullmq-mikro-orm",
        replacement: resolve(
          import.meta.dirname,
          "../bullmq-mikro-orm/src/index.js",
        ),
      },
      {
        find: "@nest-boot/crypt",
        replacement: resolve(import.meta.dirname, "../crypt/src/index.js"),
      },
      {
        find: "@nest-boot/eslint-plugin",
        replacement: resolve(
          import.meta.dirname,
          "../eslint-plugin/src/index.js",
        ),
      },
      {
        find: "@nest-boot/file-upload",
        replacement: resolve(
          import.meta.dirname,
          "../file-upload/src/index.js",
        ),
      },
      {
        find: "@nest-boot/graphql",
        replacement: resolve(import.meta.dirname, "../graphql/src/index.js"),
      },
      {
        find: "@nest-boot/graphql-connection",
        replacement: resolve(
          import.meta.dirname,
          "../graphql-connection/src/index.js",
        ),
      },
      {
        find: "@nest-boot/graphql-logger",
        replacement: resolve(
          import.meta.dirname,
          "../graphql-logger/src/index.js",
        ),
      },
      {
        find: "@nest-boot/graphql-rate-limit",
        replacement: resolve(
          import.meta.dirname,
          "../graphql-rate-limit/src/index.js",
        ),
      },
      {
        find: "@nest-boot/hash",
        replacement: resolve(import.meta.dirname, "../hash/src/index.js"),
      },
      {
        find: "@nest-boot/i18n",
        replacement: resolve(import.meta.dirname, "../i18n/src/index.js"),
      },
      {
        find: "@nest-boot/logger",
        replacement: resolve(import.meta.dirname, "../logger/src/index.js"),
      },
      {
        find: "@nest-boot/mailer",
        replacement: resolve(import.meta.dirname, "../mailer/src/index.js"),
      },
      {
        find: "@nest-boot/metrics",
        replacement: resolve(import.meta.dirname, "../metrics/src/index.js"),
      },
      {
        find: "@nest-boot/middleware",
        replacement: resolve(import.meta.dirname, "../middleware/src/index.js"),
      },
      {
        find: "@nest-boot/mikro-orm",
        replacement: resolve(import.meta.dirname, "../mikro-orm/src/index.js"),
      },
      {
        find: "@nest-boot/mikro-orm-crypt",
        replacement: resolve(
          import.meta.dirname,
          "../mikro-orm-crypt/src/index.js",
        ),
      },
      {
        find: "@nest-boot/mikro-orm-hash",
        replacement: resolve(
          import.meta.dirname,
          "../mikro-orm-hash/src/index.js",
        ),
      },
      {
        find: "@nest-boot/permission",
        replacement: resolve(import.meta.dirname, "../permission/src/index.js"),
      },
      {
        find: "@nest-boot/redis",
        replacement: resolve(import.meta.dirname, "../redis/src/index.js"),
      },
      {
        find: "@nest-boot/request-context",
        replacement: resolve(
          import.meta.dirname,
          "../request-context/src/index.js",
        ),
      },
      {
        find: "@nest-boot/row-level-security",
        replacement: resolve(
          import.meta.dirname,
          "../row-level-security/src/index.js",
        ),
      },
      {
        find: "@nest-boot/schedule",
        replacement: resolve(import.meta.dirname, "../schedule/src/index.js"),
      },
      {
        find: "@nest-boot/temporary-directory",
        replacement: resolve(
          import.meta.dirname,
          "../temporary-directory/src/index.js",
        ),
      },
      {
        find: "@nest-boot/validator",
        replacement: resolve(import.meta.dirname, "../validator/src/index.js"),
      },
      {
        find: "@nest-boot/view",
        replacement: resolve(import.meta.dirname, "../view/src/index.js"),
      },
    ],
  },
  test: {
    globals: true,
    root: "./",
    setupFiles: [
      resolve(import.meta.dirname, "../../vitest.setup.ts"),
      "./vitest.setup.ts",
    ],
    include: ["**/*.spec.ts"],
    exclude: ["dist/**", "node_modules/**", "**/*.e2e-spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      excludeAfterRemap: true,
      reportsDirectory: "./coverage",
      provider: "v8",
    },
  },
});
