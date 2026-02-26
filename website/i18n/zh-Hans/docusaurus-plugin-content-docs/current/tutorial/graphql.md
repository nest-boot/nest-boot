---
sidebar_position: 1
---

# GraphQL

`@nest-boot/graphql` 模块为 NestJS 提供了一个基于 Apollo Server 的、开箱即用的 GraphQL 设置。它包含了合理的默认配置和异常处理。

## 安装

```bash
npm install @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
# or
pnpm add @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

## 配置

在你的应用程序模块中注册 `GraphQLModule`。

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nest-boot/graphql";

@Module({
  imports: [
    GraphQLModule.forRoot({
      // 可选：配置
      // autoSchemaFile: 'schema.gql',
      // ...
    }),
  ],
})
export class AppModule {}
```

## 使用

像往常一样使用 `@nestjs/graphql` 创建你的解析器和对象类型。

```typescript
import { Resolver, Query } from "@nestjs/graphql";

@Resolver()
export class HelloResolver {
  @Query(() => String)
  hello(): string {
    return "Hello World!";
  }
}
```

该模块自动配置：

- `/api/graphql` 端点。
- Schema 文件生成 (`schema.gql`)。
- Playground (生产环境禁用，其他环境启用)。
- GraphQL 错误的全局异常过滤器。
