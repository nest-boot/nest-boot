## 7.12.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.1
- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/middleware to 7.5.1
- Updated @nest-boot/tsconfig to 7.2.1

## 7.12.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.0
- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/middleware to 7.5.0
- Updated @nest-boot/tsconfig to 7.2.0

## 7.11.2 (2026-06-09)

### 🩹 Fixes

- **auth:** update auth env defaults ([533362c9](https://github.com/nest-boot/nest-boot/commit/533362c9))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/middleware to 7.4.0
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.11.1 (2026-06-07)

### 🩹 Fixes

- **auth:** rename signup disable env vars ([1a1001b](https://github.com/nest-boot/nest-boot/commit/1a1001b))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/middleware to 7.4.0
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.11.0 (2026-06-07)

### 🚀 Features

- **auth:** support env-configured auth providers ([7b1bf46](https://github.com/nest-boot/nest-boot/commit/7b1bf46))

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/auth

## 7.10.0

### Minor Changes

- 9c35ed2: Expose `AuthGuard.isPublic()` for subclasses and guard mixins.

## 7.9.5

### Patch Changes

- 3b24b53: fix: widen AuthGuard canActivate return type to match Nest CanActivate

## 7.9.4

### Patch Changes

- 3fbaf86: fix(auth): resolve WHERE array being interpreted as OR by MikroORM

## 7.9.3

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English

## 7.9.2

### Patch Changes

- 935d7fa: fix(auth): add account configuration to skip state cookie check

## 7.9.1

### Patch Changes

- 427ffc4: fix(auth): compatible with better-auth@^1.4.6

## 7.9.0

### Minor Changes

- 6d45c18: feat(auth): add secret validation with entropy check

## 7.8.0

### Minor Changes

- 345b53d: feat: auth module to use RequestContext for session and user management, and simplify middleware options

## 7.7.5

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc

## 7.7.4

### Patch Changes

- d663833: fix: eslint

## 7.7.3

### Patch Changes

- e99f023: fix export AuthService

## 7.7.2

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages

## 7.7.1

### Patch Changes

- b64e6b7: fix: 修复 better-auth 没有禁止全局排除路由

## 7.7.0

### Minor Changes

- 3f503c8: feat: MiddlewareManager 支持全局排除路由

## 7.6.0

### Minor Changes

- cae040a: feat: 添加中间件模块，支持中间件排序。

## 7.5.0

### Minor Changes

- 8ae94c8: feat: 添加 baseURL 和 secret 环境变量配置

## 7.4.0

### Minor Changes

- 074c240: feat: 拆分出 auth-rls 和 mikro-orm-request-transaction 模块

## 7.3.0

### Minor Changes

- 95815b4: feat: 添加 @nest-boot/request-context 依赖并更新 AuthInterceptor 以支持请求上下文

### Patch Changes

- 271f5d4: fix: 修复没有导出 AuthInterceptor 和 AuthTransactionContext

## 7.2.0

### Minor Changes

- ca0a526: feat: 添加拦截器，自动启动事务并添加认证上下文

## 7.1.0

### Minor Changes

- d52d5fc: 基于 better-auth 重做 auth 模块
