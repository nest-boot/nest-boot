---
sidebar_position: 10
---

# GraphQL

The `@nest-boot/graphql` module provides GraphQL API support powered by [Apollo Server](https://www.apollographql.com/docs/apollo-server/), with code-first schema generation, exception filtering, and companion modules for logging and rate limiting.

## Installation

```bash
npm install @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
# or
pnpm add @nest-boot/graphql @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

## Basic Usage

### Module Registration

Register the `GraphQLModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nest-boot/graphql";

@Module({
  imports: [GraphQLModule.forRoot({})],
})
export class AppModule {}
```

### Async Registration

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

## Creating Resolvers

Use standard NestJS GraphQL decorators for code-first schema:

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

## Default Configuration

The module provides sensible defaults:

- **Path**: `/api/graphql`
- **Schema**: Auto-generated to `schema.gql` (code-first)
- **Sort Schema**: Enabled
- **Playground**: Disabled by default (Apollo Landing Page available)
- **Exception Filter**: Global GraphQL exception filter registered automatically

## GraphQL Logger

The `@nest-boot/graphql-logger` package provides an Apollo Server plugin that logs GraphQL operation metadata using the structured logger.

### Installation

```bash
npm install @nest-boot/graphql-logger @nest-boot/logger
# or
pnpm add @nest-boot/graphql-logger @nest-boot/logger
```

### Usage

Simply import the module — the plugin auto-registers via NestJS discovery:

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

### What It Logs

For each GraphQL operation, the plugin adds structured metadata to the request log:

- **operation.id** — Query hash
- **operation.name** — Operation name
- **operation.type** — `query`, `mutation`, or `subscription`

## GraphQL Rate Limiting

The `@nest-boot/graphql-rate-limit` package provides query complexity-based rate limiting, inspired by [Shopify's approach](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity).

### Installation

```bash
npm install @nest-boot/graphql-rate-limit graphql-query-complexity
# or
pnpm add @nest-boot/graphql-rate-limit graphql-query-complexity
```

### Usage

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

### How It Works

1. **Complexity Estimation** — Each query's complexity is calculated using multiple estimators:
   - **Directive estimator** — Uses `@complexity` directive values
   - **Field extensions estimator** — Uses field-level complexity metadata
   - **Shopify estimator** — Connection types cost `2 + childComplexity × pageSize`; objects cost `1 + childComplexity`; scalars cost `0`
   - **Simple estimator** — Default fallback complexity

2. **Rate Limiting** — Queries exceeding `maxComplexity` (default: 1000) are rejected with HTTP 429

3. **Cost Tracking** — The response includes a `cost` extension with:
   - `requestedQueryCost` — Estimated cost before execution
   - `actualQueryCost` — Actual cost after execution
   - `throttleStatus` — Current rate limit status

## API Reference

See the full API documentation for detailed information:

- [@nest-boot/graphql](/docs/api/@nest-boot/graphql)
- [@nest-boot/graphql-logger](/docs/api/@nest-boot/graphql-logger)
- [@nest-boot/graphql-rate-limit](/docs/api/@nest-boot/graphql-rate-limit)
- [@nest-boot/graphql-connection](/docs/tutorial/graphql-connection) — Relay-style pagination

## Features

- **Apollo Server** — Production-ready GraphQL server
- **Code-First** — Auto-generated schema from TypeScript types
- **Exception Filtering** — Global GraphQL error handling
- **Operation Logging** — Structured logging for all operations
- **Rate Limiting** — Shopify-style query complexity-based throttling
- **Cost Transparency** — Query cost reported in response extensions
