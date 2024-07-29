# @nest-boot/database

## 6.16.0

### Minor Changes

- 7760eec: 支持 @Transactional 装饰器控制方法是否启用事务

### Patch Changes

- Updated dependencies [87d85de]
  - @nest-boot/request-context@6.13.0

## 6.15.0

### Minor Changes

- 715b4db: 请求上下文中间件支持使用依赖控制顺序

### Patch Changes

- Updated dependencies [715b4db]
  - @nest-boot/request-context@6.12.0

## 6.14.0

### Minor Changes

- fc7a9f8: 请求上下文添加 type 字段

### Patch Changes

- Updated dependencies [fc7a9f8]
  - @nest-boot/request-context@6.11.0

## 6.13.3

### Patch Changes

- d6ebea5: 仅在 http 下启用请求事务

## 6.13.2

### Patch Changes

- c02f137: 修复在应用关闭时没有断开数据库连接

## 6.13.1

### Patch Changes

- 97cbb16: 修复 SqlEntityManager 未别名到 EntityManager

## 6.13.0

### Minor Changes

- 6daa4a6: 移除 @mikro-orm/nestjs 依赖，依赖注入代理后的 EntityManager，以从请求上下文中获取 EntityManager 对象。

### Patch Changes

- 6daa4a6: 优化请求错误日志和精简生产环境下响应错误信息内容

## 6.12.1

### Patch Changes

- f7a6b69: 改为使用 RequestContext 方式包装请求事务，以兼容 GraphQL。
- Updated dependencies [f7a6b69]
  - @nest-boot/request-context@6.10.2

## 6.12.0

### Minor Changes

- 50aafe8: 支持请求级别事务

## 6.11.1

### Patch Changes

- 8c6c5e1: 修复对等依赖
- 8c6c5e1: 可修改健康检查配置

## 6.11.0

### Minor Changes

- 8372590: 心跳检查支持自定义检测 SQL 语句

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
- Updated dependencies [8372590]
  - @nest-boot/request-context@6.10.1
  - @nest-boot/health-check@6.10.1
  - @nest-boot/common@6.10.1
