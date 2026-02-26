---
sidebar_position: 4
---

# GraphQL Rate Limit

`@nest-boot/graphql-rate-limit` 模块通过计算查询复杂度和使用 Redis 进行速率限制（令牌桶算法）来保护你的 GraphQL API 免受过度使用。

## 安装

```bash
npm install @nest-boot/graphql-rate-limit @nest-boot/redis ioredis graphql-query-complexity
# or
pnpm add @nest-boot/graphql-rate-limit @nest-boot/redis ioredis graphql-query-complexity
```

## 配置

在你的应用程序模块中注册 `GraphQLRateLimitModule`。

```typescript
import { Module } from "@nestjs/common";
import { GraphQLRateLimitModule } from "@nest-boot/graphql-rate-limit";

@Module({
  imports: [
    GraphQLRateLimitModule.forRoot({
      maxComplexity: 1000,
      maximumAvailable: 10000,
      restoreRate: 100, // 每秒恢复的点数
      // connection: { ... } // Redis 连接选项
    }),
  ],
})
export class AppModule {}
```

## 使用

该模块自动计算传入 GraphQL 查询的复杂度。

- **字段 (Fields)**: 1 点
- **连接 (Connections)**: 2 点 + (first/last 参数值 \* 子复杂度)
- **对象/接口/联合 (Objects/Interfaces/Unions)**: 1 点 + 子复杂度

如果查询超过 `maxComplexity`，它将被立即拒绝。
如果客户端的令牌桶中（基于 IP）没有足够的令牌，请求将被拒绝并返回 429 状态码。

### 自定义复杂度

你可以使用 `@nestjs/graphql` 中的装饰器或定义复杂度估算器来为特定字段自定义复杂度。

速率限制信息会在 GraphQL 响应的 `extensions` 中返回：

```json
{
  "extensions": {
    "cost": {
      "requestedQueryCost": 50,
      "actualQueryCost": 50,
      "throttleStatus": {
        "blocked": false,
        "maximumAvailable": 10000,
        "currentlyAvailable": 9950,
        "restoreRate": 100
      }
    }
  }
}
```
