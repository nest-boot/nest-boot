## 8.1.0

### Minor Changes

- 4c9ae88: Align dynamic module static configuration methods with the NestJS community guidelines:
  
  - Mark `I18nModule` and `ViewModule` with `@Global()` directly (removing `isGlobal` registration extras and supporting zero-config direct `I18nModule` imports alongside `ViewModule`).
  - Switch global once-per-application infrastructure modules (`CryptModule`, `GraphQLConnectionModule`, `HashModule`, `I18nModule`, `LoggerModule`, `MailerModule`, `RedisModule`, `StorageModule`, and `ViewModule`) from `register` / `registerAsync` to `forRoot` / `forRootAsync`, with optional default `options = {}` on `forRoot()`.
- dc8fece: Unify object storage, two-stage `tmp/` -> `files/` temporary file uploads, and JWT-signed downloads into `StorageService` in `@nest-boot/storage`, add an opt-in `POST /uploads` dynamic REST upload controller alongside the `/downloads/*` signed download controller, and replace `@nest-boot/staged-upload` and `@nest-boot/staged-upload-graphql` with `@nest-boot/storage` and `@nest-boot/storage-graphql` (`StorageGraphQLModule` / `createTemporaryFileUploadUrls`).
- e8efb52: Add `StorageService.isTemporaryFile()` to recognize a storage-relative temporary
  key or this bucket's presigned temporary resource URL.
  Temporary upload forms, preview URLs, and signed download links now default to
  a 24-hour lifetime.

### Patch Changes

- Updated dependencies [e65ce7c]
- Updated dependencies [97fad07]
- Updated dependencies [169da36]
  - @nest-boot/jwt@8.0.1
  - @nest-boot/common@8.0.1

## 8.0.4 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/tsconfig to 8.0.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.3 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/tsconfig to 8.0.0-beta.5

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.2 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.1 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3

## 8.0.3-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2

## 8.0.2-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1

## 8.0.1-beta.0 (2026-09-19)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4

## 8.0.0-beta.5 (2026-09-16)

This was a version bump only for @nest-boot/storage to align it with other projects, there were no code changes.

## 8.0.0-beta.4 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.3 (2026-09-01)

### 🚀 Features

- **storage:** add object storage and staged upload modules ([#314](https://github.com/nest-boot/nest-boot/pull/314))

### ❤️ Thank You

- Xudong Huang @xudongcc