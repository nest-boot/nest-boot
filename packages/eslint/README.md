# @nest-boot/eslint

Nest Boot 共享 ESLint flat config 与自定义代码规范规则。

## 预设配置

`@nest-boot/eslint` 采用与 `typescript-eslint` 一致的导出风格，默认导出 `{ configs, plugin }`（同时也支持具名导入 `configs` 和 `plugin`），并提供三个平铺配置预设：

| 预设                  | 内容                                                                                                                                      | 适用场景                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `configs.recommended` | `configs.standard` + `configs.rules`                                                                                                      | 开箱即用（推荐）                                      |
| `configs.standard`    | 仅通用标准规则（`@eslint/js`、`typescript-eslint`、`jsdoc`、`simple-import-sort`、`prettier` 及 `projectService: true`）                  | 仅需通用 TypeScript 代码规范，不含 Nest Boot 领域规则 |
| `configs.rules`       | 仅 Nest Boot 自定义规则（限定 `**/*.{ts,mts,cts,tsx}`，注册 `nest-boot` 插件并开启全部 7 条规则，不覆盖用户的外部规则和 `parserOptions`） | 已有自有 ESLint 配置，仅需接入 Nest Boot 规则         |

### 1. 使用完整推荐配置（推荐）

```js
import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([...nestBoot.configs.recommended]);
```

### 2. 仅启用 Nest Boot 自定义规则

如果项目已有自己的 TypeScript ESLint 配置，只需叠加 `nestBoot.configs.rules`（需确保已启用 `@typescript-eslint/parser` 和类型信息，例如 `projectService: true` 或 `project`）：

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
  ...nestBoot.configs.rules,
]);
```

### 3. 仅使用通用标准配置

```js
import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([...nestBoot.configs.standard]);
```

### 内置自定义规则列表

| 规则                                                     | 用途                                       |
| -------------------------------------------------------- | ------------------------------------------ |
| `nest-boot/database/entity-property-definite-assignment` | 检查实体字段的确定赋值断言                 |
| `nest-boot/database/entity-property-config-from-types`   | 根据 TypeScript 类型检查实体字段配置       |
| `nest-boot/database/entity-property-no-spread`           | 要求实体属性装饰器显式列出配置选项         |
| `nest-boot/graphql/field-definite-assignment`            | 检查 GraphQL 字段的确定赋值断言            |
| `nest-boot/graphql/field-config-from-types`              | 根据 TypeScript 类型检查 GraphQL 字段配置  |
| `nest-boot/graphql/no-direct-nestjs-import`              | 要求通过 Nest Boot 的公共 GraphQL 入口导入 |
| `nest-boot/queue/processor-name`                         | 检查处理器名称与队列类名一致               |

## 单独使用插件

如果只需要挑选部分规则，可以直接注册单插件 `nestBoot.plugin`：

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
      "nest-boot": nestBoot.plugin,
    },
    rules: {
      "nest-boot/database/entity-property-config-from-types": "error",
      "nest-boot/database/entity-property-definite-assignment": "error",
      "nest-boot/database/entity-property-no-spread": "error",
      "nest-boot/graphql/field-config-from-types": "error",
      "nest-boot/graphql/field-definite-assignment": "error",
      "nest-boot/graphql/no-direct-nestjs-import": "error",
      "nest-boot/queue/processor-name": "error",
    },
  },
];
```

## 迁移说明

`@nest-boot/eslint` 合并了原有的 `@nest-boot/eslint-config` 与 `@nest-boot/eslint-plugin`。迁移时将两者的依赖替换为 `@nest-boot/eslint`，并将配置文件更新为 `import nestBoot from "@nest-boot/eslint"` + `...nestBoot.configs.recommended`（或 `nestBoot.configs.rules` / `nestBoot.plugin`）。

同时请在规则配置、`eslint-disable`、`eslint-enable` 注释和 bulk suppressions 文件中更新规则 ID：

| 旧规则 ID                                        | 新规则 ID                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| `@nest-boot/entity-property-config-from-types`   | `nest-boot/database/entity-property-config-from-types`   |
| `@nest-boot/entity-property-definite-assignment` | `nest-boot/database/entity-property-definite-assignment` |
| `@nest-boot/entity-property-no-spread`           | `nest-boot/database/entity-property-no-spread`           |
| `@nest-boot/graphql-field-config-from-types`     | `nest-boot/graphql/field-config-from-types`              |
| `@nest-boot/graphql-field-definite-assignment`   | `nest-boot/graphql/field-definite-assignment`            |

## `nest-boot/queue/processor-name`

要求 `@Processor(EmailQueue)` 对应的类命名为 `EmailProcessor`。规则从队列类名去掉末尾的 `Queue`，再加上 `Processor`；例如 `JobQueue` 对应 `JobProcessor`。队列的 Redis 名称不影响检查。

```ts
@Processor(EmailQueue)
export class EmailProcessor extends BaseProcessor {}

// 报错：应命名为 EmailProcessor。
@Processor(EmailQueue)
export class SmsProcessor extends BaseProcessor {}
```

支持装饰器和队列的导入别名、命名空间导入。启用 TypeScript 类型信息时还会解析队列实际类名，包括通过变量或对象属性引用的队列。无法静态确定名称的表达式会跳过检查。规则仅报告错误，不自动重命名类和引用。
