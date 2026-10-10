## 8.0.2 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))
- 升级 Nest.js 到 v11 ([14895ac9](https://github.com/nest-boot/nest-boot/commit/14895ac9))
- 移除默认健康检查控制器，以便自定义路由和装饰器。 ([6cd5b588](https://github.com/nest-boot/nest-boot/commit/6cd5b588))
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
- 调整 Search 和 GraphQL 模块类型并更新依赖 ([8aa1cdd3](https://github.com/nest-boot/nest-boot/commit/8aa1cdd3))
- 添加队列仪表盘，并升级依赖 ([964818a9](https://github.com/nest-boot/nest-boot/commit/964818a9))
- 添加定时任务调度模块并升级依赖 ([21ec6b0c](https://github.com/nest-boot/nest-boot/commit/21ec6b0c))
- ⚠️  拆分 CommonModule 为 RequestContextModule 和 LoggerModule ([311ce896](https://github.com/nest-boot/nest-boot/commit/311ce896))
- ⚠️  v4.0.0 ([f13d7e6d](https://github.com/nest-boot/nest-boot/commit/f13d7e6d))
- 重构 ([eedb426a](https://github.com/nest-boot/nest-boot/commit/eedb426a))
- 升级依赖并支持搜索语法 ([52ca0952](https://github.com/nest-boot/nest-boot/commit/52ca0952))
- ⚠️  update nest.js v9.x ([dc0e72ca](https://github.com/nest-boot/nest-boot/commit/dc0e72ca))
- ⚠️  Mikro ORM ([48b6229d](https://github.com/nest-boot/nest-boot/commit/48b6229d))
- add tenant module ([be71e8fa](https://github.com/nest-boot/nest-boot/commit/be71e8fa))
- yarn ([73845d8f](https://github.com/nest-boot/nest-boot/commit/73845d8f))

### 🩹 Fixes

- 移除 database 和 health-check 模块并格式化代码 ([49659ef9](https://github.com/nest-boot/nest-boot/commit/49659ef9))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))
- 更新 @nest-boot/tsconfig 依赖版本为 workspace:* ([4052974e](https://github.com/nest-boot/nest-boot/commit/4052974e))
- 移除 @nest-boot/common 依赖及相关配置，更新工作流以简化发布流程 ([#147](https://github.com/nest-boot/nest-boot/pull/147))
- Update dependencies across multiple packages to latest versions. ([#137](https://github.com/nest-boot/nest-boot/pull/137))
- remove event-emitter, use tsc build ([#42](https://github.com/nest-boot/nest-boot/pull/42))
- **auth:** 修正依赖 ([2ca190c5](https://github.com/nest-boot/nest-boot/commit/2ca190c5))
- 更新对等依赖 ([d6806471](https://github.com/nest-boot/nest-boot/commit/d6806471))
- 更新依赖 ([9919c1e7](https://github.com/nest-boot/nest-boot/commit/9919c1e7))
- **health-check:** 优化可选依赖 ([382835a0](https://github.com/nest-boot/nest-boot/commit/382835a0))
- 更新依赖，graphql 和 search 恢复统计总数。 ([564f121a](https://github.com/nest-boot/nest-boot/commit/564f121a))
- 更新依赖 ([57198054](https://github.com/nest-boot/nest-boot/commit/57198054))
- **health-check:** 调整 Redis 健康检查选项 ([257ad934](https://github.com/nest-boot/nest-boot/commit/257ad934))
- **health-check:** redis 模块改为可选依赖 ([32e13f9f](https://github.com/nest-boot/nest-boot/commit/32e13f9f))
- 升级依赖，修复 GraphQL 查询不支持嵌套字段 ([324b6c67](https://github.com/nest-boot/nest-boot/commit/324b6c67))
- 使用 semantic-release ([c1b26504](https://github.com/nest-boot/nest-boot/commit/c1b26504))
- 修改包名 ([0853686a](https://github.com/nest-boot/nest-boot/commit/0853686a))
- 重构 ([6d260a07](https://github.com/nest-boot/nest-boot/commit/6d260a07))
- 删除 CHANGELOG.md ([adf7a4d6](https://github.com/nest-boot/nest-boot/commit/adf7a4d6))
- 升级依赖，Search 使用 Repository ([b0e57c5b](https://github.com/nest-boot/nest-boot/commit/b0e57c5b))
- update deps ([264e9a5f](https://github.com/nest-boot/nest-boot/commit/264e9a5f))
- update ([eb0d7674](https://github.com/nest-boot/nest-boot/commit/eb0d7674))
- use yarn ([eae365ba](https://github.com/nest-boot/nest-boot/commit/eae365ba))
- fix version ([cb0399a5](https://github.com/nest-boot/nest-boot/commit/cb0399a5))
- update ([5da4ccb6](https://github.com/nest-boot/nest-boot/commit/5da4ccb6))
- update ([93dc335a](https://github.com/nest-boot/nest-boot/commit/93dc335a))
- use turborepo ([b7245ba8](https://github.com/nest-boot/nest-boot/commit/b7245ba8))
- update deps ([f8b3664c](https://github.com/nest-boot/nest-boot/commit/f8b3664c))
- do not check dependant packages ([ca7945fc](https://github.com/nest-boot/nest-boot/commit/ca7945fc))
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
- 拆分 CommonModule 为 RequestContextModule 和 LoggerModule  ([311ce896](https://github.com/nest-boot/nest-boot/commit/311ce896))
  拆分 CommonModule 为 RequestContextModule 和 LoggerModule
- v4.0.0  ([f13d7e6d](https://github.com/nest-boot/nest-boot/commit/f13d7e6d))
  v4.0.0
- update nest.js v9.x  ([dc0e72ca](https://github.com/nest-boot/nest-boot/commit/dc0e72ca))
  it breaks something
- Mikro ORM  ([48b6229d](https://github.com/nest-boot/nest-boot/commit/48b6229d))
  Mikro ORM

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/middleware to 8.0.4
- Updated @nest-boot/tsconfig to 8.0.0

### ❤️ Thank You

- d4rkcr0w
- D4rkCr0w
- Xudong Huang @xudongcc

## 8.0.2-beta.4 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/middleware to 8.0.4-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.5

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.3 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.2 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/middleware to 8.0.4-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.1 (2026-10-09)

### 🚀 Features

- **database:** add automatic database health checks ([#400](https://github.com/nest-boot/nest-boot/pull/400))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3
- Updated @nest-boot/middleware to 8.0.4-beta.0

## 8.0.1-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2
- Updated @nest-boot/middleware to 8.0.3-beta.0

## 8.0.0-beta.2 (2026-10-09)

This was a version bump only for @nest-boot/health-check to align it with other projects, there were no code changes.

## 8.0.0-beta.1 (2026-10-08)

### 🩹 Fixes

- **release:** retain validated v8 baselines for restored packages ([#396](https://github.com/nest-boot/nest-boot/pull/396))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.0.0-beta.3 (2026-10-08)

### 🚀 Features

- **health-check:** restore registry and health middleware ([#390](https://github.com/nest-boot/nest-boot/pull/390))

### 🩹 Fixes

- 移除 database 和 health-check 模块并格式化代码 ([49659ef9](https://github.com/nest-boot/nest-boot/commit/49659ef9))
- 升级依赖 ([528189ef](https://github.com/nest-boot/nest-boot/commit/528189ef))

### ❤️ Thank You

- Xudong Huang @xudongcc