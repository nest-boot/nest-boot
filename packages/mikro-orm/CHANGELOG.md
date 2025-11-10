# @nest-boot/mikro-orm

## 7.2.0

### Minor Changes

- 4673492: feat: 优化请求上下文

## 7.1.0

### Minor Changes

- bf39843: feat: 支持软删除优化 findOne 先尝试从 Identity Map (UnitOfWork) 中取已有实体

## 7.0.1

### Patch Changes

- c77f6d3: fix: IdOrEntity can infer the correct id type

## 7.0.0

### Minor Changes

- 2ff1783: feat: mikro-orm、redis、schedule 默认从环境变量读取配置
- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用
- fb7f5e2: feat: 添加 VectorType 类型

### Patch Changes

- 4c7c772: Forced upgrade version
- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- bae5a46: fix: 修改 MikroOrmModule 中的私有方法访问修饰符并更新模块装饰器
- 50216e0: fix: 优化获取配置的方式
- 172e636: fix: 修复打包后源码目录错误
- 8469f07: fix: autoLoadEntities 默认为 false
- e4e4ddc: fix: rename loadConfigByEnv to loadConfigFromEnv
- f9c03c3: 修复 ESLint
- 46ee2e1: fix: 更新 MikroOrmModule 的模块装饰器，添加 RequestContextModule 并优化中间件注册
- 95b1c9e: 发布 mikro-orm
- Updated dependencies [cf99c26]
- Updated dependencies [79ef4a8]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
  - @nest-boot/request-context@7.0.0

## 7.0.0-beta.15

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/request-context@7.0.0-beta.4

## 7.0.0-beta.14

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
  - @nest-boot/request-context@7.0.0-beta.3

## 7.0.0-beta.13

### Minor Changes

- fb7f5e2: feat: 添加 VectorType 类型

## 7.0.0-beta.12

### Patch Changes

- 50216e0: fix: 优化获取配置的方式

## 7.0.0-beta.11

### Patch Changes

- 4c7c772: Forced upgrade version

## 7.0.0-beta.10

### Patch Changes

- 8469f07: fix: autoLoadEntities 默认为 false

## 7.0.0-beta.9

### Patch Changes

- 172e636: fix: 修复打包后源码目录错误

## 7.0.0-beta.8

### Minor Changes

- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用

## 7.0.0-beta.7

### Patch Changes

- e4e4ddc: fix: rename loadConfigByEnv to loadConfigFromEnv

## 7.0.0-beta.6

### Minor Changes

- 2ff1783: feat: mikro-orm、redis、schedule 默认从环境变量读取配置

## 7.0.0-beta.5

### Patch Changes

- 46ee2e1: fix: 更新 MikroOrmModule 的模块装饰器，添加 RequestContextModule 并优化中间件注册

## 7.0.0-beta.4

### Patch Changes

- bae5a46: fix: 修改 MikroOrmModule 中的私有方法访问修饰符并更新模块装饰器

## 7.0.0-beta.3

### Patch Changes

- 95b1c9e: 发布 mikro-orm
