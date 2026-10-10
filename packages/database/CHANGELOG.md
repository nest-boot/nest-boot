## 8.0.5 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))
- 升级 Nest.js 到 v11 ([14895ac9](https://github.com/nest-boot/nest-boot/commit/14895ac9))
- 添加 @SearchableProperty 语法糖 ([b3ca0ad8](https://github.com/nest-boot/nest-boot/commit/b3ca0ad8))
- 支持 @Transactional 装饰器控制方法是否启用事务 ([7760eecf](https://github.com/nest-boot/nest-boot/commit/7760eecf))
- 请求上下文中间件支持使用依赖控制顺序 ([#122](https://github.com/nest-boot/nest-boot/pull/122))
- RequestContext.type 属性，认证守卫数据库查询移动到请求上下文中间件实现。 ([#120](https://github.com/nest-boot/nest-boot/pull/120))
- 支持请求级别事务 ([#108](https://github.com/nest-boot/nest-boot/pull/108))
- 心跳检查支持自定义检测 SQL 语句 ([#100](https://github.com/nest-boot/nest-boot/pull/100))
- updating dependency packages ([#59](https://github.com/nest-boot/nest-boot/pull/59))
- ⚠️  refactoring based on MikroORM v6 ([8a9bdcae](https://github.com/nest-boot/nest-boot/commit/8a9bdcae))
- Can ignore importing the RequestContextModule ([#37](https://github.com/nest-boot/nest-boot/pull/37))
- **queue:** 队列增加 @Consumer 装饰器并添加示例 ([#14](https://github.com/nest-boot/nest-boot/pull/14))
- **search:** 搜索语法支持字段别名，并添加一个 pg 全文搜索示例。 ([42aa26b6](https://github.com/nest-boot/nest-boot/commit/42aa26b6))
- database 和 redis 健康检查自动注入 ([76822e0f](https://github.com/nest-boot/nest-boot/commit/76822e0f))
- 调度改为依赖队列实现，升级依赖。 ([1c0280d4](https://github.com/nest-boot/nest-boot/commit/1c0280d4))
- 拆分 queue-dashboard，移除 swc 因为不支持生成 d.ts ([84638281](https://github.com/nest-boot/nest-boot/commit/84638281))
- ⚠️  升级到 Nest.js v10 并启用 SWC ([d295aa04](https://github.com/nest-boot/nest-boot/commit/d295aa04))
- **database:** 添加软删除装饰器 ([267848e5](https://github.com/nest-boot/nest-boot/commit/267848e5))
- 调整 Search 和 GraphQL 模块类型并更新依赖 ([8aa1cdd3](https://github.com/nest-boot/nest-boot/commit/8aa1cdd3))
- RequestContext 支持中间件，队列不用再手工注入上下文。 ([497e887c](https://github.com/nest-boot/nest-boot/commit/497e887c))
- 添加队列仪表盘，并升级依赖 ([964818a9](https://github.com/nest-boot/nest-boot/commit/964818a9))
- 添加队列模块，重构定时任务和数据库入口 ([2ec92163](https://github.com/nest-boot/nest-boot/commit/2ec92163))
- 添加定时任务调度模块并升级依赖 ([21ec6b0c](https://github.com/nest-boot/nest-boot/commit/21ec6b0c))
- ⚠️  拆分 CommonModule 为 RequestContextModule 和 LoggerModule ([311ce896](https://github.com/nest-boot/nest-boot/commit/311ce896))
- ⚠️  v4.0.0 ([f13d7e6d](https://github.com/nest-boot/nest-boot/commit/f13d7e6d))
- 重构 ([eedb426a](https://github.com/nest-boot/nest-boot/commit/eedb426a))
- 更新搜索语法解析器 ([fc237516](https://github.com/nest-boot/nest-boot/commit/fc237516))
- 升级依赖并支持搜索语法 ([52ca0952](https://github.com/nest-boot/nest-boot/commit/52ca0952))
- ⚠️  update nest.js v9.x ([dc0e72ca](https://github.com/nest-boot/nest-boot/commit/dc0e72ca))
- migration format ([f541e881](https://github.com/nest-boot/nest-boot/commit/f541e881))
- database config util ([16de263a](https://github.com/nest-boot/nest-boot/commit/16de263a))
- ⚠️  Mikro ORM ([48b6229d](https://github.com/nest-boot/nest-boot/commit/48b6229d))
- add tenant module ([be71e8fa](https://github.com/nest-boot/nest-boot/commit/be71e8fa))
- Independent search engine ([#1](https://github.com/nest-boot/nest-boot/pull/1))
- yarn ([73845d8f](https://github.com/nest-boot/nest-boot/commit/73845d8f))

### 🩹 Fixes

- 移除 database 和 health-check 模块并格式化代码 ([49659ef9](https://github.com/nest-boot/nest-boot/commit/49659ef9))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))
- 更新 @nest-boot/tsconfig 依赖版本为 workspace:* ([4052974e](https://github.com/nest-boot/nest-boot/commit/4052974e))
- 移除 @nest-boot/common 依赖及相关配置，更新工作流以简化发布流程 ([#147](https://github.com/nest-boot/nest-boot/pull/147))
- Update dependencies across multiple packages to latest versions. ([#137](https://github.com/nest-boot/nest-boot/pull/137))
- 关闭数据库连接前先回滚所有活动的事务。 ([#128](https://github.com/nest-boot/nest-boot/pull/128))
- 修复在应用关闭时没有断开数据库连接 ([#116](https://github.com/nest-boot/nest-boot/pull/116))
- 修复 SqlEntityManager 未别名到 EntityManager ([#114](https://github.com/nest-boot/nest-boot/pull/114))
- 改为使用 RequestContext 方式包装请求事务，以兼容 GraphQL。 ([#110](https://github.com/nest-boot/nest-boot/pull/110))
- 暴露健康检查配置 ([#102](https://github.com/nest-boot/nest-boot/pull/102))
- deps ([#46](https://github.com/nest-boot/nest-boot/pull/46))
- remove event-emitter, use tsc build ([#42](https://github.com/nest-boot/nest-boot/pull/42))
- **database:** nO_COLOR to MIKRO_ORM_NO_COLOR prevent conflict ([2fc193f5](https://github.com/nest-boot/nest-boot/commit/2fc193f5))
- **database:** 去除 MikroORM 自带的 RequestContext，以优化性能。 ([2c39df4a](https://github.com/nest-boot/nest-boot/commit/2c39df4a))
- **auth:** 修正依赖 ([2ca190c5](https://github.com/nest-boot/nest-boot/commit/2ca190c5))
- **database:** 修正 forFeature 类型 ([30c3bd19](https://github.com/nest-boot/nest-boot/commit/30c3bd19))
- 更新依赖 ([9919c1e7](https://github.com/nest-boot/nest-boot/commit/9919c1e7))
- 更新依赖，graphql 和 search 恢复统计总数。 ([564f121a](https://github.com/nest-boot/nest-boot/commit/564f121a))
- 优化关闭 debug 的情况下也会输出日志 ([b36e02ec](https://github.com/nest-boot/nest-boot/commit/b36e02ec))
- 调整 Database 注册中间件 ([3c19164b](https://github.com/nest-boot/nest-boot/commit/3c19164b))
- 更新依赖 ([57198054](https://github.com/nest-boot/nest-boot/commit/57198054))
- 升级依赖，修复 GraphQL 查询不支持嵌套字段 ([324b6c67](https://github.com/nest-boot/nest-boot/commit/324b6c67))
- 修复搜索模块不能关联查询 ([3e6bed3f](https://github.com/nest-boot/nest-boot/commit/3e6bed3f))
- 使用 semantic-release ([c1b26504](https://github.com/nest-boot/nest-boot/commit/c1b26504))
- 修改包名 ([0853686a](https://github.com/nest-boot/nest-boot/commit/0853686a))
- update ([7bfb6067](https://github.com/nest-boot/nest-boot/commit/7bfb6067))
- 重构 ([6d260a07](https://github.com/nest-boot/nest-boot/commit/6d260a07))
- 升级依赖，Search 使用 Repository ([b0e57c5b](https://github.com/nest-boot/nest-boot/commit/b0e57c5b))
- **database:** update peer dependencies ([93c6e242](https://github.com/nest-boot/nest-boot/commit/93c6e242))
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
- fix sql-formatter deps ([61eb8f42](https://github.com/nest-boot/nest-boot/commit/61eb8f42))
- update deps ([41adaffa](https://github.com/nest-boot/nest-boot/commit/41adaffa))
- use workspace deps ([8ef440b6](https://github.com/nest-boot/nest-boot/commit/8ef440b6))
- update deps ([a08f25d6](https://github.com/nest-boot/nest-boot/commit/a08f25d6))
- fix dependencies ([fd0068b0](https://github.com/nest-boot/nest-boot/commit/fd0068b0))
- fix dependencies ([e30eb305](https://github.com/nest-boot/nest-boot/commit/e30eb305))
- build error ([7ea68012](https://github.com/nest-boot/nest-boot/commit/7ea68012))
- compatible with semantic-release ([94aa63cd](https://github.com/nest-boot/nest-boot/commit/94aa63cd))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))
- refactoring based on MikroORM v6  ([8a9bdcae](https://github.com/nest-boot/nest-boot/commit/8a9bdcae))
  MikroORM v6
- 升级到 Nest.js v10 并启用 SWC  ([d295aa04](https://github.com/nest-boot/nest-boot/commit/d295aa04))
  升级到 Nest.js v10 并启用 SWC
- 拆分 CommonModule 为 RequestContextModule 和 LoggerModule  ([311ce896](https://github.com/nest-boot/nest-boot/commit/311ce896))
  拆分 CommonModule 为 RequestContextModule 和 LoggerModule
- v4.0.0  ([f13d7e6d](https://github.com/nest-boot/nest-boot/commit/f13d7e6d))
  v4.0.0
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

### ❤️ Thank You

- d4rkcr0w
- D4rkCr0w
- Xudong Huang @xudongcc

## 8.0.5-beta.6 (2026-10-10)

This was a version bump only for @nest-boot/database to align it with other projects, there were no code changes.

## 8.0.5-beta.5 (2026-10-10)

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

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.4 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.2
- Updated @nest-boot/health-check to 8.0.2-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.3 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.1
- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/health-check to 8.0.2-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.2 (2026-10-10)

### 🩹 Fixes

- **release:** recover incomplete npm publications ([#403](https://github.com/nest-boot/nest-boot/pull/403))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.1 (2026-10-09)

### 🚀 Features

- **database:** add automatic database health checks ([#400](https://github.com/nest-boot/nest-boot/pull/400))

### 🧱 Updated Dependencies

- Updated @nest-boot/health-check to 8.0.2-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3

## 8.0.4-beta.1 (2026-10-09)

### 🚀 Features

- ⚠️  **database:** rename database integration packages and APIs ([#397](https://github.com/nest-boot/nest-boot/pull/397))

### 🩹 Fixes

- 移除 database 和 health-check 模块并格式化代码 ([49659ef9](https://github.com/nest-boot/nest-boot/commit/49659ef9))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))

### ⚠️  Breaking Changes

- **database:** rename database integration packages and APIs  ([#397](https://github.com/nest-boot/nest-boot/pull/397))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.3-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.0 (2026-09-23)

### 🩹 Fixes

- **eslint-plugin:** generate valid MikroORM 7 decorator imports ([#370](https://github.com/nest-boot/nest-boot/pull/370))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.2-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.3 (2026-09-20)

### 🩹 Fixes

- **mikro-orm:** hydrate entity service references ([#342](https://github.com/nest-boot/nest-boot/pull/342))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.2 (2026-09-19)

### 🚀 Features

- ⚠️  **auth:** unify auth entities, services and GraphQL APIs ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### ⚠️  Breaking Changes

- **auth:** unify auth entities, services and GraphQL APIs  ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.1-beta.0
- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.1 (2026-09-16)

### 🚀 Features

- ⚠️  **mikro-orm:** adopt native RLS and remove the custom RLS package ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ⚠️  Breaking Changes

- **mikro-orm:** adopt native RLS and remove the custom RLS package  ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.0 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))
- ⚠️  **mikro-orm:** replace MySQL and SQLite with PGlite ([#326](https://github.com/nest-boot/nest-boot/pull/326))

### 🩹 Fixes

- **release:** keep beta releases on the v8 line ([#328](https://github.com/nest-boot/nest-boot/pull/328))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))
- **mikro-orm:** replace MySQL and SQLite with PGlite  ([#326](https://github.com/nest-boot/nest-boot/pull/326))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 9.0.0-beta.1 (2026-09-08)

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

## 9.0.0-beta.0 (2026-09-07)

### 🚀 Features

- ⚠️  **mikro-orm:** replace MySQL and SQLite with PGlite ([#326](https://github.com/nest-boot/nest-boot/pull/326))

### ⚠️  Breaking Changes

- **mikro-orm:** replace MySQL and SQLite with PGlite  ([#326](https://github.com/nest-boot/nest-boot/pull/326))

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

## 7.7.7 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.6
- Updated @nest-boot/eslint-config to 7.3.5
- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/tsconfig to 7.3.5

## 7.7.6 (2026-08-29)

### 🩹 Fixes

- **mikro-orm:** batch entity service operations per context ([#308](https://github.com/nest-boot/nest-boot/pull/308))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.7.5 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.5
- Updated @nest-boot/eslint-config to 7.3.4
- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/tsconfig to 7.3.4

## 7.7.4 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.4
- Updated @nest-boot/eslint-config to 7.3.3
- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/tsconfig to 7.3.3

## 7.7.3 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.3

## 7.7.2 (2026-08-28)

### 🚀 Features

- **config:** use URL-only environment connections ([8b50be63](https://github.com/nest-boot/nest-boot/commit/8b50be63))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.2
- Updated @nest-boot/eslint-config to 7.3.2
- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/tsconfig to 7.3.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.7.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.1
- Updated @nest-boot/eslint-config to 7.3.1
- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/tsconfig to 7.3.1

## 7.7.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.0
- Updated @nest-boot/eslint-config to 7.3.0
- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/tsconfig to 7.3.0

## 7.6.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.1
- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1

## 7.6.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.0
- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0

## 7.5.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/mikro-orm

## 7.4.0

### Minor Changes

- dbce7e8: feat: wrap entity removal in transactions to ensure data consistency in entity service

## 7.3.2

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English
- Updated dependencies [3f42c62]
  - @nest-boot/request-context@7.4.3

## 7.3.1

### Patch Changes

- 8be49e8: fix(mikro-orm): move base configuration inside loadConfigFromEnv function

## 7.3.0

### Minor Changes

- d0b5699: feat(mikro-orm): add logging support and update configuration options

## 7.2.4

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc
- Updated dependencies [372cb9e]
- Updated dependencies [372cb9e]
  - @nest-boot/request-context@7.4.2

## 7.2.3

### Patch Changes

- d663833: fix: eslint

## 7.2.2

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages
- Updated dependencies [bf35af9]
  - @nest-boot/request-context@7.4.1

## 7.2.1

### Patch Changes

- 59f76aa: fix: 修复 EntityService.findOne 返回错误

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
