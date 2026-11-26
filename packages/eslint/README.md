# @nest-boot/eslint

Nest Boot 共享 ESLint v9 flat config 预设与自定义代码规范插件。

## 安装与使用

### 1. 使用完整预设（推荐）

业务应用使用 `@nest-boot/eslint/app`（与 `@nest-boot/tsconfig/app.json` 对齐）：

```js
import app from "@nest-boot/eslint/app";
import { defineConfig } from "eslint/config";

export default defineConfig([...app]);
```

可复用库使用 `@nest-boot/eslint/library`（与 `@nest-boot/tsconfig/library.json` 对齐）：

```js
import library from "@nest-boot/eslint/library";
import { defineConfig } from "eslint/config";

export default defineConfig([...library]);
```

### 2. 仅作为 ESLint 插件接入已有配置

如果项目已有自有 TypeScript ESLint 配置，可通过主入口导入标准 ESLint 插件并叠加 `nestBoot.configs.recommended`（需启用 `@typescript-eslint/parser` 与类型服务 `projectService: true`）：

```js
import js from "@eslint/js";
import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";
import tsEslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...tsEslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
  },
  ...nestBoot.configs.recommended,
]);
```

### 3. 单独按需配置规则

`@nest-boot/eslint` 主入口默认导出符合 ESLint v9 标准的单插件对象 `{ meta, rules, configs }`，可直接挂载在 `"nest-boot"` 命名空间下：

```js
import nestBoot from "@nest-boot/eslint";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true },
    },
    plugins: {
      "nest-boot": nestBoot,
    },
    rules: {
      "nest-boot/database-entity-property-config-from-types": "error",
      "nest-boot/graphql-field-config-from-types": "error",
    },
  },
];
```

## Exports & Configs

| 入口                                                 | 说明                                                                                                    |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `@nest-boot/eslint/app`                              | 业务应用完整预设（通用 JS/TS/JSDoc/Import/Prettier 规则 + `nestBoot.configs.recommended`）              |
| `@nest-boot/eslint/library`                          | 可复用库完整预设（通用 JS/TS/JSDoc/Import/Prettier 规则 + `nestBoot.configs.recommended`）              |
| `@nest-boot/eslint` (`nestBoot.configs.recommended`) | 标准 ESLint 插件推荐预设（仅注册 `nest-boot` 插件并启用全部领域规则，不覆盖外部规则与 `parserOptions`） |

## Rules

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
✅ Set in the `recommended` configuration.\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💭 Requires [type information](https://typescript-eslint.io/linting/typed-linting).

| Name                                                                                                       | Description                                                                                                            | 💼  | 🔧  | 💭  |
| :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :-- | :-- | :-- |
| [database-entity-property-config-from-types](docs/rules/database-entity-property-config-from-types.md)     | enforce @Property and @Enum decorator configuration from TypeScript types and require Opt<T> on initialized properties | ✅  | 🔧  | 💭  |
| [database-entity-property-definite-assignment](docs/rules/database-entity-property-definite-assignment.md) | require definite assignment assertions on uninitialized entity properties                                              | ✅  | 🔧  |     |
| [database-entity-property-no-spread](docs/rules/database-entity-property-no-spread.md)                     | require explicit options in entity field decorators                                                                    | ✅  |     |     |
| [graphql-field-config-from-types](docs/rules/graphql-field-config-from-types.md)                           | enforce @Field decorator type and nullable configuration from TypeScript types                                         | ✅  | 🔧  | 💭  |
| [graphql-field-definite-assignment](docs/rules/graphql-field-definite-assignment.md)                       | require definite assignment assertions on uninitialized GraphQL @Field properties                                      | ✅  | 🔧  |     |
| [graphql-no-direct-nestjs-import](docs/rules/graphql-no-direct-nestjs-import.md)                           | require importing GraphQL symbols through the Nest Boot public entry point                                             | ✅  |     |     |
| [queue-processor-name](docs/rules/queue-processor-name.md)                                                 | require a processor class name to match its declared queue class                                                       | ✅  |     | 💭  |

<!-- end auto-generated rules list -->

## 迁移说明

`@nest-boot/eslint` 合并了原有的 `@nest-boot/eslint-config` 与 `@nest-boot/eslint-plugin`。迁移时将依赖统一替换为 `@nest-boot/eslint`（应用导入 `@nest-boot/eslint/app`，库导入 `@nest-boot/eslint/library`，仅使用插件规则导入 `@nest-boot/eslint` 并使用 `nestBoot.configs.recommended`），并将规则 ID 更新为 `nest-boot/<domain>-<rule>`：

| 旧规则 ID                                        | 新规则 ID                                                |
| :----------------------------------------------- | :------------------------------------------------------- |
| `@nest-boot/entity-property-config-from-types`   | `nest-boot/database-entity-property-config-from-types`   |
| `@nest-boot/entity-property-definite-assignment` | `nest-boot/database-entity-property-definite-assignment` |
| `@nest-boot/entity-property-no-spread`           | `nest-boot/database-entity-property-no-spread`           |
| `@nest-boot/graphql-field-config-from-types`     | `nest-boot/graphql-field-config-from-types`              |
| `@nest-boot/graphql-field-definite-assignment`   | `nest-boot/graphql-field-definite-assignment`            |
| `@nest-boot/queue/processor-name`                | `nest-boot/queue-processor-name`                         |
