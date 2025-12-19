---
sidebar_position: 4
---

# Redis Module

The `@nest-boot/redis` module provides Redis connection management using [ioredis](https://github.com/redis/ioredis). It supports automatic configuration from environment variables and graceful shutdown handling.

## Installation

```bash
npm install @nest-boot/redis ioredis
# or
pnpm add @nest-boot/redis ioredis
```

## Basic Usage

### Module Registration

Register the `RedisModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({
      host: "localhost",
      port: 6379,
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### Using Environment Variables

The module automatically loads configuration from environment variables if no options are provided:

```typescript
import { Module } from "@nestjs/common";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    // Will use REDIS_* environment variables
    RedisModule.register({ isGlobal: true }),
  ],
})
export class AppModule {}
```

### Async Registration

For configuration from other services:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.get("REDIS_HOST"),
        port: config.get("REDIS_PORT"),
        password: config.get("REDIS_PASSWORD"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Using Redis Client

Inject the `Redis` client directly into your service:

```typescript
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class CacheService {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, "EX", ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

## Example: Session Storage

```typescript
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class SessionService {
  private readonly prefix = "session:";
  private readonly ttl = 3600; // 1 hour

  constructor(private readonly redis: Redis) {}

  async createSession(userId: string, data: object): Promise<string> {
    const sessionId = crypto.randomUUID();
    const key = `${this.prefix}${sessionId}`;

    await this.redis.set(
      key,
      JSON.stringify({ userId, ...data }),
      "EX",
      this.ttl,
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<object | null> {
    const key = `${this.prefix}${sessionId}`;
    const data = await this.redis.get(key);

    return data ? JSON.parse(data) : null;
  }

  async destroySession(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    await this.redis.del(key);
  }

  async refreshSession(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    await this.redis.expire(key, this.ttl);
  }
}
```

## API Reference

See the full [API documentation](/docs/api/@nest-boot/redis) for detailed information.

## Environment Variables

The module supports automatic configuration from the following environment variables:

| Variable                         | Description                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`                      | Full Redis connection URL (e.g., `redis://user:pass@host:6379/0`). Takes precedence over individual settings. Use `rediss://` for TLS. |
| `REDIS_HOST`                     | Redis server hostname                                                                                                                  |
| `REDIS_PORT`                     | Redis server port                                                                                                                      |
| `REDIS_DB` or `REDIS_DATABASE`   | Redis database number                                                                                                                  |
| `REDIS_USER` or `REDIS_USERNAME` | Redis username                                                                                                                         |
| `REDIS_PASS` or `REDIS_PASSWORD` | Redis password                                                                                                                         |
| `REDIS_TLS`                      | Enable TLS connection (any truthy value)                                                                                               |

## Configuration Options

All [ioredis RedisOptions](https://redis.github.io/ioredis/index.html#RedisOptions) are supported, including:

| Option          | Type       | Description                       |
| --------------- | ---------- | --------------------------------- |
| `host`          | `string`   | Redis server hostname             |
| `port`          | `number`   | Redis server port (default: 6379) |
| `db`            | `number`   | Redis database number             |
| `username`      | `string`   | Redis username                    |
| `password`      | `string`   | Redis password                    |
| `tls`           | `object`   | TLS connection options            |
| `keyPrefix`     | `string`   | Prefix to add to all keys         |
| `retryStrategy` | `function` | Custom retry strategy             |

## Features

- **Auto Configuration** - Automatically loads settings from environment variables
- **Global Module** - Can be registered as a global module with `isGlobal: true`
- **Graceful Shutdown** - Automatically closes Redis connection on application shutdown
- **Full ioredis Support** - Access to all ioredis features (pub/sub, streams, pipelines, etc.)
