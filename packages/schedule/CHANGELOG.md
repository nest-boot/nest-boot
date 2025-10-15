# @nest-boot/schedule

## 7.0.0-beta.13

### Patch Changes

- 50216e0: fix: 优化获取配置的方式
- Updated dependencies [50216e0]
  - @nest-boot/bullmq@7.0.0-beta.5

## 7.0.0-beta.12

### Patch Changes

- 2fe46e6: fix: 修复启动逻辑

## 7.0.0-beta.11

### Patch Changes

- f5a64fc: fix: 修复 schedule 错误的导入 bullmq 模块

## 7.0.0-beta.10

### Minor Changes

- fa9731d: fix: add autorun option to ScheduleModuleOptions and update ScheduleProcessor to support it

## 7.0.0-beta.9

### Patch Changes

- 4c7c772: Forced upgrade version

## 7.0.0-beta.8

### Major Changes

- 9895ff6: fix: 修复 removeOnComplete 和 removeOnFail 参数使用错误

## 7.0.0-beta.7

### Minor Changes

- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用

### Patch Changes

- Updated dependencies [81fae6e]
  - @nest-boot/bullmq@7.0.0-beta.3

## 7.0.0-beta.6

### Minor Changes

- 2ff1783: feat: mikro-orm、redis、schedule 默认从环境变量读取配置

## 7.0.0-beta.5

### Minor Changes

- 3a17f44: refactor: migrate schedule module to use @nestjs/bullmq, update interfaces and implement schedule processor

## 7.0.0-beta.3

### Patch Changes

- 49659ef: fix: 移除 database 和 health-check 模块并格式化代码

## 7.0.0-beta.2

### Patch Changes

- b5e6548: 重新发布版本
- Updated dependencies [b5e6548]
  - @nest-boot/queue@7.0.0-beta.2
  - @nest-boot/request-context@7.0.0-beta.2

## 7.0.0-beta.1

### Patch Changes

- 79ef4a8: 移除 @nest-boot/common 依赖
- Updated dependencies [79ef4a8]
  - @nest-boot/request-context@7.0.0-beta.1
  - @nest-boot/queue@7.0.0-beta.1

## 7.0.0-beta.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- Updated dependencies [14895ac]
- Updated dependencies [011fec5]
  - @nest-boot/request-context@7.0.0-beta.0
  - @nest-boot/common@7.0.0-beta.0
  - @nest-boot/queue@7.0.0-beta.0

## 6.10.4

### Patch Changes

- bcd62cb: fix: Update dependencies across multiple packages to latest versions.
- Updated dependencies [bcd62cb]
  - @nest-boot/request-context@6.15.1
  - @nest-boot/common@6.10.2
  - @nest-boot/queue@6.12.1

## 6.10.3

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
  - @nest-boot/request-context@6.10.1
  - @nest-boot/common@6.10.1
  - @nest-boot/queue@6.11.5

## 6.10.2

### Patch Changes

- 0d9be95: 解决重复执行定时任务的问题

## 6.10.1

### Patch Changes

- Updated dependencies [c1cb714]
  - @nest-boot/queue@6.10.1
