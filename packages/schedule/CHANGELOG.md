# @nest-boot/schedule

## 7.0.0

### Major Changes

- 9895ff6: fix: 修复 removeOnComplete 和 removeOnFail 参数使用错误
- 14895ac: ESLint 升级到 v9

### Minor Changes

- 2ff1783: feat: mikro-orm、redis、schedule 默认从环境变量读取配置
- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用
- fa9731d: fix: add autorun option to ScheduleModuleOptions and update ScheduleProcessor to support it
- 3a17f44: refactor: migrate schedule module to use @nestjs/bullmq, update interfaces and implement schedule processor

### Patch Changes

- 49659ef: fix: 移除 database 和 health-check 模块并格式化代码
- 4c7c772: Forced upgrade version
- f5a64fc: fix: 修复 schedule 错误的导入 bullmq 模块
- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- 50216e0: fix: 优化获取配置的方式
- 2fe46e6: fix: 修复启动逻辑
- 79ef4a8: 移除 @nest-boot/common 依赖
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [d9b1965]
- Updated dependencies [0b05db2]
- Updated dependencies [20f3262]
- Updated dependencies [81fae6e]
- Updated dependencies [50216e0]
- Updated dependencies [3a447d2]
- Updated dependencies [f9c03c3]
  - @nest-boot/bullmq@7.0.0

## 7.0.0-beta.15

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/bullmq@7.0.0-beta.9

## 7.0.0-beta.14

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- Updated dependencies [20f3262]
  - @nest-boot/bullmq@7.0.0-beta.8
