# @nest-boot/logger

## 7.0.2

### Patch Changes

- fc9a08c: feat: 日志默认屏蔽请求头的 authorization 和 cookie 字段，非生产环境可以在请求头添加 x-logging: false 来关闭日志。

## 7.0.1

### Patch Changes

- 274a9c7: feat: 日志默认屏蔽请求头的 authorization 和 cookie 字段，非开发环境可以在请求头添加 x-logging: false 来关闭日志。

## 7.0.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- 97179ae: 修复日志打印不传对象参数时 context 会丢失
- 79ef4a8: 移除 @nest-boot/common 依赖
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [cf99c26]
- Updated dependencies [79ef4a8]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
  - @nest-boot/request-context@7.0.0

## 7.0.0-beta.4

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/request-context@7.0.0-beta.4

## 7.0.0-beta.3

### Patch Changes

- 97179ae: 修复日志打印不传对象参数时 context 会丢失

## 7.0.0-beta.2

### Patch Changes

- b5e6548: 重新发布版本
- Updated dependencies [b5e6548]
  - @nest-boot/request-context@7.0.0-beta.2

## 7.0.0-beta.1

### Patch Changes

- 79ef4a8: 移除 @nest-boot/common 依赖
- Updated dependencies [79ef4a8]
  - @nest-boot/request-context@7.0.0-beta.1

## 7.0.0-beta.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- Updated dependencies [14895ac]
  - @nest-boot/request-context@7.0.0-beta.0
  - @nest-boot/common@7.0.0-beta.0

## 6.12.1

### Patch Changes

- bcd62cb: fix: Update dependencies across multiple packages to latest versions.
- Updated dependencies [bcd62cb]
  - @nest-boot/request-context@6.15.1
  - @nest-boot/common@6.10.2

## 6.12.0

### Minor Changes

- 7267c10: 日志跟踪请求上下文 ID 和 类型。

### Patch Changes

- Updated dependencies [7267c10]
  - @nest-boot/request-context@6.14.0

## 6.11.1

### Patch Changes

- 4846ed2: 修复上下文获取失败。

## 6.11.0

### Minor Changes

- 715b4db: 请求上下文中间件支持使用依赖控制顺序

### Patch Changes

- Updated dependencies [715b4db]
  - @nest-boot/request-context@6.12.0

## 6.10.1

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
  - @nest-boot/request-context@6.10.1
  - @nest-boot/common@6.10.1
