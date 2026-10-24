# @nest-boot/eslint-plugin

Nest Boot 日常代码规范规则。`@nest-boot/eslint-config` 默认启用以下规则：

| 规则                                           | 用途                                      |
| ---------------------------------------------- | ----------------------------------------- |
| `@nest-boot/entity-field-definite-assignment`  | 检查实体字段的确定赋值断言                |
| `@nest-boot/entity-property-config-from-types` | 根据 TypeScript 类型检查实体字段配置      |
| `@nest-boot/graphql-field-definite-assignment` | 检查 GraphQL 字段的确定赋值断言           |
| `@nest-boot/graphql-field-config-from-types`   | 根据 TypeScript 类型检查 GraphQL 字段配置 |
| `@nest-boot/queue/processor-name`              | 检查处理器名称与队列类名一致              |

单独使用插件时，默认导出注册为 `@nest-boot`，Queue 规则使用具名导出 `queuePlugin`：

```js
import nestBootPlugin, { queuePlugin } from "@nest-boot/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true },
    },
    plugins: { "@nest-boot": nestBootPlugin, "@nest-boot/queue": queuePlugin },
    rules: {
      "@nest-boot/entity-property-config-from-types": "error",
      "@nest-boot/graphql-field-config-from-types": "error",
      "@nest-boot/queue/processor-name": "error",
    },
  },
];
```

### `@nest-boot/queue/processor-name`

要求 `@Processor(EmailQueue)` 对应的类命名为 `EmailProcessor`。规则从队列类名去掉末尾的 `Queue`，再加上 `Processor`；例如 `JobQueue` 对应 `JobProcessor`。队列的 Redis 名称不影响检查。

```ts
@Processor(EmailQueue)
export class EmailProcessor extends BaseProcessor {}

// 报错：应命名为 EmailProcessor。
@Processor(EmailQueue)
export class SmsProcessor extends BaseProcessor {}
```

支持装饰器和队列的导入别名、命名空间导入。启用 TypeScript 类型信息时还会解析队列实际类名，包括通过变量或对象属性引用的队列。无法静态确定名称的表达式会跳过检查。规则仅报告错误，不自动重命名类和引用。

## 移除旧迁移规则配置

已移除 `import-bullmq`、`import-queue`、`import-mikro-orm`、`import-database`、`import-graphql`，不提供兼容别名。删除自定义 ESLint 配置中的对应条目，包括设为 `off` 的条目。

包名、导入路径和旧 API 的迁移由开发者手动完成。实体字段规则也不再迁移旧 MikroORM 装饰器、命名空间导入、重导出或 `@mikro-orm/knex` 路径；字段配置修复仍会添加所需的当前 API 导入。
