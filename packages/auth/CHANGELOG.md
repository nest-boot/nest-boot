# @nest-boot/auth

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
