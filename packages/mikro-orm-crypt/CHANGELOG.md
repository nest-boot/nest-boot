## 8.0.0-beta.0 (2026-06-23)

### 🚀 Features

- ⚠️  migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))

### ⚠️  Breaking Changes

- migrate packages to Node 26 ESM and Vitest  ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))
  @nest-boot packages now target NestJS 12 next, require Node.js >=26, publish as ES modules, require MikroORM v7, and use Vitest instead of Jest.

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.0
- Updated @nest-boot/crypt to 8.0.0-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.4.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1
- Updated @nest-boot/crypt to 7.3.1

## 7.4.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0
- Updated @nest-boot/crypt to 7.3.0

## 7.3.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0
- Updated @nest-boot/crypt to 7.2.0

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/mikro-orm-crypt

## 7.2.1

### Patch Changes

- 0ce6d1e: fix: upgrade to jose@6 and update Node.js requirements

## 7.2.0

### Minor Changes

- 57ed699: feat(mikro-orm-crypt): add EncryptedProperty decorator for MikroORM entity encryption
- 512f317: feat(crypt): add isJwe utility for proper JWE format detection
