import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@nest-boot/auth",
        replacement: resolve(__dirname, "../auth/src"),
      },
      {
        find: "@nest-boot/bullmq",
        replacement: resolve(__dirname, "../bullmq/src"),
      },
      {
        find: "@nest-boot/bullmq-mikro-orm",
        replacement: resolve(__dirname, "../bullmq-mikro-orm/src"),
      },
      {
        find: "@nest-boot/crypt",
        replacement: resolve(__dirname, "../crypt/src"),
      },
      {
        find: "@nest-boot/eslint-plugin",
        replacement: resolve(__dirname, "../eslint-plugin/src"),
      },
      {
        find: "@nest-boot/file-upload",
        replacement: resolve(__dirname, "../file-upload/src"),
      },
      {
        find: "@nest-boot/graphql",
        replacement: resolve(__dirname, "../graphql/src"),
      },
      {
        find: "@nest-boot/graphql-connection",
        replacement: resolve(__dirname, "../graphql-connection/src"),
      },
      {
        find: "@nest-boot/graphql-logger",
        replacement: resolve(__dirname, "../graphql-logger/src"),
      },
      {
        find: "@nest-boot/graphql-rate-limit",
        replacement: resolve(__dirname, "../graphql-rate-limit/src"),
      },
      {
        find: "@nest-boot/hash",
        replacement: resolve(__dirname, "../hash/src"),
      },
      {
        find: "@nest-boot/i18n",
        replacement: resolve(__dirname, "../i18n/src"),
      },
      {
        find: "@nest-boot/logger",
        replacement: resolve(__dirname, "../logger/src"),
      },
      {
        find: "@nest-boot/mailer",
        replacement: resolve(__dirname, "../mailer/src"),
      },
      {
        find: "@nest-boot/metrics",
        replacement: resolve(__dirname, "../metrics/src"),
      },
      {
        find: "@nest-boot/middleware",
        replacement: resolve(__dirname, "../middleware/src"),
      },
      {
        find: "@nest-boot/mikro-orm",
        replacement: resolve(__dirname, "../mikro-orm/src"),
      },
      {
        find: "@nest-boot/mikro-orm-crypt",
        replacement: resolve(__dirname, "../mikro-orm-crypt/src"),
      },
      {
        find: "@nest-boot/mikro-orm-hash",
        replacement: resolve(__dirname, "../mikro-orm-hash/src"),
      },
      {
        find: "@nest-boot/permission",
        replacement: resolve(__dirname, "../permission/src"),
      },
      {
        find: "@nest-boot/redis",
        replacement: resolve(__dirname, "../redis/src"),
      },
      {
        find: "@nest-boot/request-context",
        replacement: resolve(__dirname, "../request-context/src"),
      },
      {
        find: "@nest-boot/row-level-security",
        replacement: resolve(__dirname, "../row-level-security/src"),
      },
      {
        find: "@nest-boot/schedule",
        replacement: resolve(__dirname, "../schedule/src"),
      },
      {
        find: "@nest-boot/validator",
        replacement: resolve(__dirname, "../validator/src"),
      },
      {
        find: "@nest-boot/view",
        replacement: resolve(__dirname, "../view/src"),
      },
      { find: /^lodash-es\/(.*)\.js$/, replacement: "lodash/$1" },
    ],
  },
  test: {
    globals: true,
    root: "./",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.spec.ts"],
    exclude: ["dist/**", "node_modules/**", "**/*.e2e-spec.ts"],
    coverage: {
      reportsDirectory: "./coverage",
      provider: "v8",
    },
  },
});
