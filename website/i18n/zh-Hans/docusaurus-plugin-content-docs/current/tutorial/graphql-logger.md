---
sidebar_position: 3
---

# GraphQL Logger

`@nest-boot/graphql-logger` 模块使用 `@nest-boot/logger` 为 GraphQL 操作提供自动日志记录。

## 安装

```bash
npm install @nest-boot/graphql-logger
# or
pnpm add @nest-boot/graphql-logger
```

## 配置

在你的应用程序模块中注册 `GraphQLLoggerModule`。

```typescript
import { Module } from "@nestjs/common";
import { GraphQLLoggerModule } from "@nest-boot/graphql-logger";

@Module({
  imports: [GraphQLLoggerModule.forRoot()],
})
export class AppModule {}
```

## 使用

一旦注册，该模块会自动将插件附加到 Apollo Server。对于每个 GraphQL 请求，它会用以下信息丰富日志上下文：

- `operation.id`: 查询哈希
- `operation.name`: 操作名称（如果提供）
- `operation.type`: 操作类型（query, mutation, subscription）

这允许你将日志与特定的 GraphQL 操作关联起来。
