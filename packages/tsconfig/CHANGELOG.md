# @nest-boot/tsconfig

## 7.0.2

### Patch Changes

- 3f14d03: Remove inherited `baseUrl` settings from shared TypeScript configuration and package tsconfigs.

  This keeps path resolution explicit and avoids package-local aliases being interpreted relative to a shared base config. Existing path aliases are preserved by using explicit relative `paths` entries where needed, including docs collection paths.

## 7.0.1

### Patch Changes

- 372cb9e: fix: add typedoc

## 7.0.0

### Major Changes

- 20a36b8: v7

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- b5e6548: 重新发布版本

## 7.0.0-beta.1

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块

## 7.0.0-beta.0

### Major Changes

- 20a36b8: v7

### Patch Changes

- b5e6548: 重新发布版本
