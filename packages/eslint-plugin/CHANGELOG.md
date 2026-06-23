## 8.0.0-beta.0 (2026-06-23)

### 🚀 Features

- ⚠️ migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))

### 🩹 Fixes

- **ci:** increase eslint plugin test timeout ([f98a4bb](https://github.com/nest-boot/nest-boot/commit/f98a4bb))

### ⚠️ Breaking Changes

- migrate packages to Node 26 ESM and Vitest ([e5ce890](https://github.com/nest-boot/nest-boot/commit/e5ce890))
  @nest-boot packages now target NestJS 12 next, require Node.js >=26, publish as ES modules, require MikroORM v7, and use Vitest instead of Jest.

### 🧱 Updated Dependencies

- Updated @nest-boot/tsconfig to 8.0.0-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.1.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/tsconfig to 7.2.1

## 7.1.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/tsconfig to 7.2.0

## 7.0.8 (2026-06-07)

### 🧱 Updated Dependencies

- Updated @nest-boot/tsconfig to 7.1.0

# @nest-boot/eslint-plugin

## 7.0.7

### Patch Changes

- c6eceed: Fix MikroORM enum fixer output to add the missing `Enum` import, and preserve custom file upload URL path prefixes.

## 7.0.6

### Patch Changes

- 3f14d03: Remove inherited `baseUrl` settings from shared TypeScript configuration and package tsconfigs.

  This keeps path resolution explicit and avoids package-local aliases being interpreted relative to a shared base config. Existing path aliases are preserved by using explicit relative `paths` entries where needed, including docs collection paths.

## 7.0.5

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English

## 7.0.4

### Patch Changes

- 0a36908: fix(eslint-plugin): support PrimaryKey, EncryptedProperty and HashedProperty decorators

## 7.0.3

### Patch Changes

- e3bde0c: fix: add peerDependencies for TypeScript and ESLint in eslint-plugin package.json

## 7.0.2

### Patch Changes

- 57ee97b: fix: 添加 MikroORM 的 ESLint 规则 Date 和 boolean 类型会修复 Property 装饰器的类型参数。

## 7.0.1

### Patch Changes

- ffa3871: fix: 增强实体字段明确赋值规则以支持关系装饰器

## 7.0.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint

## 7.0.0-beta.3

### Patch Changes

- f9c03c3: 修复 ESLint

## 7.0.0-beta.2

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
