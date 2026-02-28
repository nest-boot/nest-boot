---
sidebar_position: 10
---

# GraphQL

`@nest-boot/graphql` 模块提供基于 [Apollo Server](https://www.apollographql.com/docs/apollo-server/) 的 GraphQL API 支持，包含代码优先的 Schema 生成、异常过滤，以及日志和限流的配套模块。

## 安装

```bash
npm install @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
# 或
pnpm add @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

## 基本用法

### 模块注册

在应用模块中注册 `GraphQLModule`：

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nest-boot/graphql";

@Module({
  imports: [GraphQLModule.forRoot({})],
})
export class AppModule {}
```

### 异步注册

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nest-boot/graphql";

@Module({
  imports: [
    ConfigModule.forRoot(),
    GraphQLModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        playground: config.get("NODE_ENV") !== "production",
      }),
    }),
  ],
})
export class AppModule {}
```

## 创建 Resolver

使用标准的 NestJS GraphQL 装饰器实现代码优先的 Schema：

```typescript
import { Query, Resolver, Mutation, Args } from "@nestjs/graphql";
import { User } from "./user.model";

@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  async users() {
    return this.userService.findAll();
  }

  @Mutation(() => User)
  async createUser(@Args("name") name: string) {
    return this.userService.create({ name });
  }
}
```

## 默认配置

模块提供合理的默认值：

- **路径**：`/api/graphql`
- **Schema**：自动生成到 `schema.gql`（代码优先）
- **Schema 排序**：已启用
- **Playground**：默认禁用（可使用 Apollo Landing Page）
- **异常过滤器**：自动注册全局 GraphQL 异常过滤器

## GraphQL 日志

`@nest-boot/graphql-logger` 包提供 Apollo Server 插件，使用结构化日志记录 GraphQL 操作元数据。

### 安装

```bash
npm install @nest-boot/graphql-logger @nest-boot/logger
# 或
pnpm add @nest-boot/graphql-logger @nest-boot/logger
```

### 用法

只需导入模块 — 插件通过 NestJS 发现机制自动注册：

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nest-boot/graphql";
import { LoggerModule } from "@nest-boot/logger";
import { GraphQLLoggerModule } from "@nest-boot/graphql-logger";

@Module({
  imports: [
    GraphQLModule.forRoot({}),
    LoggerModule.register({}),
    GraphQLLoggerModule,
  ],
})
export class AppModule {}
```

### 记录内容

对于每个 GraphQL 操作，插件会将结构化元数据添加到请求日志中：

- **operation.id** — 查询哈希
- **operation.name** — 操作名称
- **operation.type** — `query`、`mutation` 或 `subscription`

## GraphQL 限流

`@nest-boot/graphql-rate-limit` 包提供基于查询复杂度的限流，灵感来自 [Shopify 的方案](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity)。

### 安装

```bash
npm install @nest-boot/graphql-rate-limit graphql-query-complexity
# 或
pnpm add @nest-boot/graphql-rate-limit graphql-query-complexity
```

### 用法

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nest-boot/graphql";
import { GraphQLRateLimitModule } from "@nest-boot/graphql-rate-limit";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({ isGlobal: true }),
    GraphQLModule.forRoot({}),
    GraphQLRateLimitModule.register({}),
  ],
})
export class AppModule {}
```

### 工作原理

1. **复杂度估算** — 使用多个估算器计算每个查询的复杂度：
   - **指令估算器** — 使用 `@complexity` 指令值
   - **字段扩展估算器** — 使用字段级别的复杂度元数据
   - **Shopify 估算器** — Connection 类型成本为 `2 + childComplexity × pageSize`；对象成本为 `1 + childComplexity`；标量成本为 `0`
   - **简单估算器** — 默认回退复杂度

2. **限流** — 超过 `maxComplexity`（默认：1000）的查询将返回 HTTP 429

3. **成本追踪** — 响应中包含 `cost` 扩展：
   - `requestedQueryCost` — 执行前的估算成本
   - `actualQueryCost` — 执行后的实际成本
   - `throttleStatus` — 当前限流状态

## API 参考

查看完整的 API 文档获取详细信息：

- [@nest-boot/graphql](/docs/api/@nest-boot/graphql)
- [@nest-boot/graphql-logger](/docs/api/@nest-boot/graphql-logger)
- [@nest-boot/graphql-rate-limit](/docs/api/@nest-boot/graphql-rate-limit)
- [@nest-boot/graphql-connection](/docs/tutorial/graphql-connection) — Relay 风格分页

## 特性

- **Apollo Server** — 生产级 GraphQL 服务器
- **代码优先** — 从 TypeScript 类型自动生成 Schema
- **异常过滤** — 全局 GraphQL 错误处理
- **操作日志** — 所有操作的结构化日志
- **限流** — Shopify 风格的查询复杂度限流
- **成本透明** — 查询成本在响应扩展中报告
