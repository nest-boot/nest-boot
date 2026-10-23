# @nest-boot/eslint-plugin

Nest Boot 日常代码规范规则。`@nest-boot/eslint-config` 默认启用以下规则：

| 规则                                           | 用途                                      |
| ---------------------------------------------- | ----------------------------------------- |
| `@nest-boot/entity-field-definite-assignment`  | 检查实体字段的确定赋值断言                |
| `@nest-boot/entity-property-config-from-types` | 根据 TypeScript 类型检查实体字段配置      |
| `@nest-boot/graphql-field-definite-assignment` | 检查 GraphQL 字段的确定赋值断言           |
| `@nest-boot/graphql-field-config-from-types`   | 根据 TypeScript 类型检查 GraphQL 字段配置 |

单独使用插件时，将默认导出注册为 `@nest-boot`：

```js
import nestBootPlugin from "@nest-boot/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true },
    },
    plugins: { "@nest-boot": nestBootPlugin },
    rules: {
      "@nest-boot/entity-property-config-from-types": "error",
      "@nest-boot/graphql-field-config-from-types": "error",
    },
  },
];
```

## 移除旧迁移规则配置

已移除 `import-bullmq`、`import-queue`、`import-mikro-orm`、`import-database`、`import-graphql`，不提供兼容别名。删除自定义 ESLint 配置中的对应条目，包括设为 `off` 的条目。

包名、导入路径和旧 API 的迁移由开发者手动完成。实体字段规则也不再迁移旧 MikroORM 装饰器、命名空间导入、重导出或 `@mikro-orm/knex` 路径；字段配置修复仍会添加所需的当前 API 导入。
