## 8.0.7 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))
- mikro-orm, schedule, bullmq 非动态模块也能直接使用 ([81fae6e4](https://github.com/nest-boot/nest-boot/commit/81fae6e4))
- 升级 Nest.js 到 v11 ([14895ac9](https://github.com/nest-boot/nest-boot/commit/14895ac9))
- 心跳检查支持自定义检测 SQL 语句 ([#100](https://github.com/nest-boot/nest-boot/pull/100))
- updating dependency packages ([#59](https://github.com/nest-boot/nest-boot/pull/59))
- ⚠️  refactoring based on MikroORM v6 ([8a9bdcae](https://github.com/nest-boot/nest-boot/commit/8a9bdcae))
- Can ignore importing the RequestContextModule ([#37](https://github.com/nest-boot/nest-boot/pull/37))
- **queue:** 队列增加 @Consumer 装饰器并添加示例 ([#14](https://github.com/nest-boot/nest-boot/pull/14))
- **request-context:** 请求上下文支持 repl ([#12](https://github.com/nest-boot/nest-boot/pull/12))
- **search:** 搜索语法支持字段别名，并添加一个 pg 全文搜索示例。 ([42aa26b6](https://github.com/nest-boot/nest-boot/commit/42aa26b6))
- database 和 redis 健康检查自动注入 ([76822e0f](https://github.com/nest-boot/nest-boot/commit/76822e0f))
- 调度改为依赖队列实现，升级依赖。 ([1c0280d4](https://github.com/nest-boot/nest-boot/commit/1c0280d4))
- 拆分 queue-dashboard，移除 swc 因为不支持生成 d.ts ([84638281](https://github.com/nest-boot/nest-boot/commit/84638281))
- ⚠️  升级到 Nest.js v10 并启用 SWC ([d295aa04](https://github.com/nest-boot/nest-boot/commit/d295aa04))
- 调整 Search 和 GraphQL 模块类型并更新依赖 ([8aa1cdd3](https://github.com/nest-boot/nest-boot/commit/8aa1cdd3))
- RequestContext 支持中间件，队列不用再手工注入上下文。 ([497e887c](https://github.com/nest-boot/nest-boot/commit/497e887c))
- **queue:** 队列仪表盘支持查看详情 ([8ea53ded](https://github.com/nest-boot/nest-boot/commit/8ea53ded))
- **queue:** 队列 add 时支持设置 timeout 参数 ([92132954](https://github.com/nest-boot/nest-boot/commit/92132954))
- 添加队列仪表盘，并升级依赖 ([964818a9](https://github.com/nest-boot/nest-boot/commit/964818a9))
- **queue:** 使用 QueueManager 导出启动方法 ([3848de39](https://github.com/nest-boot/nest-boot/commit/3848de39))
- 添加队列模块，重构定时任务和数据库入口 ([2ec92163](https://github.com/nest-boot/nest-boot/commit/2ec92163))
- 重构 ([eedb426a](https://github.com/nest-boot/nest-boot/commit/eedb426a))
- 更新搜索语法解析器 ([fc237516](https://github.com/nest-boot/nest-boot/commit/fc237516))
- 升级依赖并支持搜索语法 ([52ca0952](https://github.com/nest-boot/nest-boot/commit/52ca0952))
- ⚠️  update nest.js v9.x ([dc0e72ca](https://github.com/nest-boot/nest-boot/commit/dc0e72ca))
- ⚠️  Mikro ORM ([48b6229d](https://github.com/nest-boot/nest-boot/commit/48b6229d))
- redo logger ([cf9707bb](https://github.com/nest-boot/nest-boot/commit/cf9707bb))
- queue enable shutdown hooks ([01f19f00](https://github.com/nest-boot/nest-boot/commit/01f19f00))
- add tenant module ([be71e8fa](https://github.com/nest-boot/nest-boot/commit/be71e8fa))
- yarn ([73845d8f](https://github.com/nest-boot/nest-boot/commit/73845d8f))

### 🩹 Fixes

- 重构 eslint-plugin 和移除 queue 模块 ([20f32628](https://github.com/nest-boot/nest-boot/commit/20f32628))
- 添加 @nestjs/platform-express 依赖并更新 pnpm-lock.yaml ([fd8a32f7](https://github.com/nest-boot/nest-boot/commit/fd8a32f7))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))
- 更新 @nest-boot/tsconfig 依赖版本为 workspace:* ([4052974e](https://github.com/nest-boot/nest-boot/commit/4052974e))
- 移除 @nest-boot/common 依赖及相关配置，更新工作流以简化发布流程 ([#147](https://github.com/nest-boot/nest-boot/pull/147))
- Update dependencies across multiple packages to latest versions. ([#137](https://github.com/nest-boot/nest-boot/pull/137))
- improve test coverage ([#55](https://github.com/nest-boot/nest-boot/pull/55))
- The register and registerAsync methods support empty parameters. ([#48](https://github.com/nest-boot/nest-boot/pull/48))
- **queue:** remove legacy processor decorator and related code ([d1b6a919](https://github.com/nest-boot/nest-boot/commit/d1b6a919))
- remove event-emitter, use tsc build ([#42](https://github.com/nest-boot/nest-boot/pull/42))
- 更新依赖 ([9919c1e7](https://github.com/nest-boot/nest-boot/commit/9919c1e7))
- 更新依赖，graphql 和 search 恢复统计总数。 ([564f121a](https://github.com/nest-boot/nest-boot/commit/564f121a))
- 修复没有导出 QueueModuleOptions 和 ScheduleModuleOptions ([be29b2c7](https://github.com/nest-boot/nest-boot/commit/be29b2c7))
- 更新依赖 ([57198054](https://github.com/nest-boot/nest-boot/commit/57198054))
- 修正请求上下文的用法 ([cf84d9d9](https://github.com/nest-boot/nest-boot/commit/cf84d9d9))
- **queue:** 修复缺少 redis-info 依赖 ([af49a437](https://github.com/nest-boot/nest-boot/commit/af49a437))
- **queue:** addBulk 也支持 timeout 参数 ([9d32f00f](https://github.com/nest-boot/nest-boot/commit/9d32f00f))
- 修复注入队列失败 ([3a982c96](https://github.com/nest-boot/nest-boot/commit/3a982c96))
- **queue:** 修复缺少 InjectQueue ([ca7ac479](https://github.com/nest-boot/nest-boot/commit/ca7ac479))
- 升级依赖，Search 使用 Repository ([b0e57c5b](https://github.com/nest-boot/nest-boot/commit/b0e57c5b))
- update deps ([264e9a5f](https://github.com/nest-boot/nest-boot/commit/264e9a5f))
- update ([eb0d7674](https://github.com/nest-boot/nest-boot/commit/eb0d7674))
- use yarn ([eae365ba](https://github.com/nest-boot/nest-boot/commit/eae365ba))
- fix version ([cb0399a5](https://github.com/nest-boot/nest-boot/commit/cb0399a5))
- update ([5da4ccb6](https://github.com/nest-boot/nest-boot/commit/5da4ccb6))
- update ([93dc335a](https://github.com/nest-boot/nest-boot/commit/93dc335a))
- use turborepo ([b7245ba8](https://github.com/nest-boot/nest-boot/commit/b7245ba8))
- update deps ([f8b3664c](https://github.com/nest-boot/nest-boot/commit/f8b3664c))
- update deps ([ffc2dd30](https://github.com/nest-boot/nest-boot/commit/ffc2dd30))
- fix deps ([0b27785a](https://github.com/nest-boot/nest-boot/commit/0b27785a))
- update deps ([41adaffa](https://github.com/nest-boot/nest-boot/commit/41adaffa))
- use workspace deps ([8ef440b6](https://github.com/nest-boot/nest-boot/commit/8ef440b6))
- update deps ([a08f25d6](https://github.com/nest-boot/nest-boot/commit/a08f25d6))
- fix dependencies ([fd0068b0](https://github.com/nest-boot/nest-boot/commit/fd0068b0))
- build error ([7ea68012](https://github.com/nest-boot/nest-boot/commit/7ea68012))
- compatible with semantic-release ([94aa63cd](https://github.com/nest-boot/nest-boot/commit/94aa63cd))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))
- refactoring based on MikroORM v6  ([8a9bdcae](https://github.com/nest-boot/nest-boot/commit/8a9bdcae))
  MikroORM v6
- 升级到 Nest.js v10 并启用 SWC  ([d295aa04](https://github.com/nest-boot/nest-boot/commit/d295aa04))
  升级到 Nest.js v10 并启用 SWC
- update nest.js v9.x  ([dc0e72ca](https://github.com/nest-boot/nest-boot/commit/dc0e72ca))
  it breaks something
- Mikro ORM  ([48b6229d](https://github.com/nest-boot/nest-boot/commit/48b6229d))
  Mikro ORM

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4
- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/health-check to 8.0.2
- Updated @nest-boot/tsconfig to 8.0.0
- Updated @nest-boot/redis to 8.0.5

### ❤️ Thank You

- d4rkcr0w
- D4rkCr0w
- Xudong Huang @xudongcc

## 8.0.7-beta.4 (2026-10-10)

### 🧱 Updated Dependencies

- Updated @nest-boot/redis to 8.0.5-beta.4

## 8.0.7-beta.3 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.3
- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/health-check to 8.0.2-beta.4
- Updated @nest-boot/tsconfig to 8.0.0-beta.5
- Updated @nest-boot/redis to 8.0.5-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.2 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.2
- Updated @nest-boot/health-check to 8.0.2-beta.3
- Updated @nest-boot/redis to 8.0.5-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.1 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.1
- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/health-check to 8.0.2-beta.2
- Updated @nest-boot/redis to 8.0.5-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/health-check to 8.0.2-beta.1
- Updated @nest-boot/redis to 8.0.5-beta.0

## 8.0.6-beta.1 (2026-10-09)

### 🚀 Features

- ⚠️  **queue:** rename queue integration packages and APIs ([#398](https://github.com/nest-boot/nest-boot/pull/398))
- mikro-orm, schedule, bullmq 非动态模块也能直接使用 ([81fae6e4](https://github.com/nest-boot/nest-boot/commit/81fae6e4))

### 🩹 Fixes

- 重构 eslint-plugin 和移除 queue 模块 ([20f32628](https://github.com/nest-boot/nest-boot/commit/20f32628))
- 添加 @nestjs/platform-express 依赖并更新 pnpm-lock.yaml ([fd8a32f7](https://github.com/nest-boot/nest-boot/commit/fd8a32f7))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))

### ⚠️  Breaking Changes

- **queue:** rename queue integration packages and APIs  ([#398](https://github.com/nest-boot/nest-boot/pull/398))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3
- Updated @nest-boot/health-check to 8.0.2-beta.0
- Updated @nest-boot/redis to 8.0.4-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.6-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.3-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2
- Updated @nest-boot/health-check to 8.0.1-beta.0
- Updated @nest-boot/redis to 8.0.3-beta.0

## 8.0.5-beta.2 (2026-10-09)

### 🚀 Features

- **bullmq:** register queue health indicators automatically ([#394](https://github.com/nest-boot/nest-boot/pull/394))

### 🧱 Updated Dependencies

- Updated @nest-boot/health-check to 8.0.0-beta.2
- Updated @nest-boot/redis to 8.0.2-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.1 (2026-10-08)

### 🚀 Features

- **bullmq:** create request contexts for event handlers ([#384](https://github.com/nest-boot/nest-boot/pull/384))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.2-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1
- Updated @nest-boot/redis to 8.0.2-beta.0

## 8.0.4-beta.1 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/redis to 8.0.1-beta.1

## 8.0.4-beta.0 (2026-09-19)

### 🚀 Features

- ⚠️  **mikro-orm:** adopt native RLS and remove the custom RLS package ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ⚠️  Breaking Changes

- **mikro-orm:** adopt native RLS and remove the custom RLS package  ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.1-beta.0
- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.0 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.6
- Updated @nest-boot/eslint-config to 8.0.0-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2 (2026-09-07)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.5

## 8.0.1 (2026-09-04)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.4

# 8.0.0 (2026-09-01)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.2 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.2
- Updated @nest-boot/eslint-config to 8.0.0-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.2

## 8.0.0-beta.1 (2026-08-31)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.1
- Updated @nest-boot/eslint-config to 8.0.0-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.1
- Updated @nest-boot/tsconfig to 8.0.0-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.7 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.6
- Updated @nest-boot/eslint-config to 7.3.5
- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/tsconfig to 7.3.5

## 7.3.6 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.5
- Updated @nest-boot/eslint-config to 7.3.4
- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/tsconfig to 7.3.4

## 7.3.5 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.4
- Updated @nest-boot/eslint-config to 7.3.3
- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/tsconfig to 7.3.3

## 7.3.4 (2026-08-28)

### 🩹 Fixes

- **bullmq:** forward all processor arguments ([#300](https://github.com/nest-boot/nest-boot/pull/300), [#285](https://github.com/nest-boot/nest-boot/issues/285))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.3 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.3

## 7.3.2 (2026-08-28)

### 🚀 Features

- **config:** use URL-only environment connections ([8b50be63](https://github.com/nest-boot/nest-boot/commit/8b50be63))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.2
- Updated @nest-boot/eslint-config to 7.3.2
- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/tsconfig to 7.3.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.1
- Updated @nest-boot/eslint-config to 7.3.1
- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/tsconfig to 7.3.1

## 7.3.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.0
- Updated @nest-boot/eslint-config to 7.3.0
- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/tsconfig to 7.3.0

## 7.2.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.1
- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1

## 7.2.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.0
- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0

## 7.1.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/bullmq

## 7.0.3

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English
- Updated dependencies [3f42c62]
  - @nest-boot/request-context@7.4.3

## 7.0.2

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc
- Updated dependencies [372cb9e]
- Updated dependencies [372cb9e]
  - @nest-boot/request-context@7.4.2

## 7.0.1

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages
- Updated dependencies [bf35af9]
  - @nest-boot/request-context@7.4.1

## 7.0.0

### Minor Changes

- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用

### Patch Changes

- d9b1965: fix: enhance environment variable loading for Redis and BullMQ to support TLS configuration
- 0b05db2: fix: 增强 Processor 装饰器以支持多种签名和选项
- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- 50216e0: fix: 优化获取配置的方式
- 3a447d2: fix: 修复优化 Redis 和 BullMQ 模块的环境变量加载
- f9c03c3: 修复 ESLint
- Updated dependencies [cf99c26]
- Updated dependencies [79ef4a8]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
  - @nest-boot/request-context@7.0.0

## 7.0.0-beta.9

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/request-context@7.0.0-beta.4

## 7.0.0-beta.8

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
  - @nest-boot/request-context@7.0.0-beta.3

## 7.0.0-beta.7

### Patch Changes

- d9b1965: fix: enhance environment variable loading for Redis and BullMQ to support TLS configuration

## 7.0.0-beta.6

### Patch Changes

- 3a447d2: fix: 修复优化 Redis 和 BullMQ 模块的环境变量加载

## 7.0.0-beta.5

### Patch Changes

- 50216e0: fix: 优化获取配置的方式

## 7.0.0-beta.4

### Patch Changes

- 0b05db2: fix: 增强 Processor 装饰器以支持多种签名和选项

## 7.0.0-beta.3

### Minor Changes

- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用
