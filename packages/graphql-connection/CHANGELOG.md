## 8.0.0-beta.0 (2026-06-23)

### 🚀 Features

- ⚠️  migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))

### ⚠️  Breaking Changes

- migrate packages to Node 26 ESM and Vitest  ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))
  @nest-boot packages now target NestJS 12 next, require Node.js >=26, publish as ES modules, require MikroORM v7, and use Vitest instead of Jest.

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.0
- Updated @nest-boot/graphql to 8.0.0-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.9.1 (2026-06-17)

### 🩹 Fixes

- update filter query schema dependency ([#275](https://github.com/nest-boot/nest-boot/pull/275))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1
- Updated @nest-boot/graphql to 7.2.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.9.0 (2026-06-17)

### 🚀 Features

- support fulltext field mapping in graphql connection ([#274](https://github.com/nest-boot/nest-boot/pull/274))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0
- Updated @nest-boot/graphql to 7.2.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.8.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0
- Updated @nest-boot/graphql to 7.1.5

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/graphql-connection

## 7.7.2

### Patch Changes

- fadc3d0: fix: disable identity map for count queries in connection query builder

## 7.7.1

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English

## 7.7.0

### Minor Changes

- db0a4ba: feat(graphql-connection): support prefix search

## 7.6.3

### Patch Changes

- f242b5b: fix(graphql-connection): pass fulltext option to search-syntax for full-text search

## 7.6.2

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc

## 7.6.1

### Patch Changes

- fc593f8: fix: upgrade search-syntax

## 7.6.0

### Minor Changes

- 5684aab: feat: connectionBuilder.build newly added return filterQuerySchema

## 7.5.0

### Minor Changes

- 7636d13: feat: support $fulltext

## 7.4.0

### Minor Changes

- ce5c7b7: feat: improve field options handling and add UnknownFieldError for better error management
- ce5c7b7: feat: add zod dependency and enhance connection query builder with filter capabilities
- ce5c7b7: feat: use search-syntax library for query string parsing

## 7.3.0

### Minor Changes

- f1180a5: feat: improve field options handling and add UnknownFieldError for better error management
- f1180a5: feat: add zod dependency and enhance connection query builder with filter capabilities

## 7.2.1

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages

## 7.2.0

### Minor Changes

- 4e8cd0e: feat: ConnectionBuilder 构建结果携带实体名称作为前缀

## 7.1.0

### Minor Changes

- c752bdc: feat: GraphQL Connection Module changed to global module

## 7.0.1

### Patch Changes

- a1a2490: fix: update @nest-boot dependencies to version 7.0.0 across multiple packages

## 7.0.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- 762ad68: 更新 @nestjs/apollo 依赖版本至 ^13.0.0
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [49659ef]
- Updated dependencies [34591c8]
- Updated dependencies [20f3262]
- Updated dependencies [79ef4a8]
- Updated dependencies [eec2ebc]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
- Updated dependencies [aeedd1c]
  - @nest-boot/graphql@7.0.0

## 7.0.0-beta.4

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/graphql@7.0.0-beta.7

## 7.0.0-beta.3

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- Updated dependencies [20f3262]
  - @nest-boot/graphql@7.0.0-beta.6

## 7.0.0-beta.2

### Patch Changes

- b5e6548: 重新发布版本

## 7.0.0-beta.1

### Patch Changes

- 762ad68: 更新 @nestjs/apollo 依赖版本至 ^13.0.0

## 7.0.0-beta.0

### Major Changes

- 14895ac: ESLint 升级到 v9

## 6.10.4

### Patch Changes

- bcd62cb: fix: Update dependencies across multiple packages to latest versions.
- Updated dependencies [bcd62cb]
  - @nest-boot/database@6.17.1
  - @nest-boot/common@6.10.2

## 6.10.3

### Patch Changes

- d19de29: fix: 固定 chevrotain 版本为 10.5.0

## 6.10.2

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
- Updated dependencies [8372590]
  - @nest-boot/database@6.11.0
  - @nest-boot/common@6.10.1

## 6.10.1

### Patch Changes

- fba38d1: 修复 totalCount 统计不遵守过滤器的问题

## 7.0.0

### Major Changes

- 0bb91b3: 重新实现 GraphQL Connection
