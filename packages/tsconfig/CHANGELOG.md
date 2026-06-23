## 8.0.0-beta.0 (2026-06-23)

### 🚀 Features

- ⚠️ migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))

### ⚠️ Breaking Changes

- migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))
  @nest-boot packages now target NestJS 12 next, require Node.js >=26, publish as ES modules, require MikroORM v7, and use Vitest instead of Jest.

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.2.1 (2026-06-17)

This was a version bump only for @nest-boot/tsconfig to align it with other projects, there were no code changes.

## 7.2.0 (2026-06-17)

This was a version bump only for @nest-boot/tsconfig to align it with other projects, there were no code changes.

## 7.1.0 (2026-06-07)

This was a version bump only for @nest-boot/tsconfig to align it with other projects, there were no code changes.

# @nest-boot/tsconfig

## 7.0.3

### Patch Changes

- e97438a: Add Jest and Node globals to the shared TypeScript base config so package test files resolve `describe`, `it`, `expect`, and Node APIs without local tsconfig overrides.

## 7.0.2

### Patch Changes

- 3f14d03: Remove inherited `baseUrl` settings from shared TypeScript configuration and package tsconfigs.

  This keeps path resolution explicit and avoids package-local aliases being interpreted relative to a shared base config. Existing path aliases are preserved by using explicit relative `paths` entries where needed, including docs collection paths.

## 7.0.1

### Patch Changes

- 372cb9e: fix: add typedoc

## 7.0.0

### Major Changes

- 20a36b8: v7

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- b5e6548: 重新发布版本

## 7.0.0-beta.1

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块

## 7.0.0-beta.0

### Major Changes

- 20a36b8: v7

### Patch Changes

- b5e6548: 重新发布版本
