# @nest-boot/auth

## 6.13.0

### Minor Changes

- 7760eec: 支持 @Transactional 装饰器控制方法是否启用事务

### Patch Changes

- 3f1bd18: 临时禁止更新最后使用时间
- Updated dependencies [7760eec]
- Updated dependencies [87d85de]
  - @nest-boot/database@6.16.0
  - @nest-boot/request-context@6.13.0

## 6.12.0

### Minor Changes

- 715b4db: 请求上下文中间件支持使用依赖控制顺序

### Patch Changes

- Updated dependencies [715b4db]
  - @nest-boot/request-context@6.12.0
  - @nest-boot/database@6.15.0

## 6.11.0

### Minor Changes

- fc7a9f8: 请求上下文添加 type 字段
- fc7a9f8: 认证守卫移除数据库相关代码，移动到请求上下文中间件中实现，防止在 GraphQL 下重复查询数据库。

### Patch Changes

- Updated dependencies [fc7a9f8]
  - @nest-boot/request-context@6.11.0
  - @nest-boot/database@6.14.0

## 6.10.7

### Patch Changes

- 50aafe8: 认证模块支持设置全局模块
- Updated dependencies [50aafe8]
  - @nest-boot/database@6.12.0

## 6.10.6

### Patch Changes

- 02ec51f: 认证模块内禁用所有过滤器

## 6.10.5

### Patch Changes

- 8c6c5e1: 修复对等依赖
- Updated dependencies [8c6c5e1]
- Updated dependencies [8c6c5e1]
  - @nest-boot/database@6.11.1

## 6.10.4

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
- Updated dependencies [8372590]
  - @nest-boot/database@6.11.0
  - @nest-boot/request-context@6.10.1
  - @nest-boot/common@6.10.1
  - @nest-boot/i18n@6.10.1

## 6.10.3

### Patch Changes

- a52e8ae: Fix decorator failure when using custom entities

## 6.10.2

### Patch Changes

- a2ff6d7: Supports AUTH_USER and AUTH_PERSONAL_ACCESS_TOKEN aliases

## 6.10.1

### Patch Changes

- 377ae02: Fix not using a custom entity class when setting up a request context
