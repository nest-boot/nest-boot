---
sidebar_position: 2
---

# Redis

The `@nest-boot/redis` module provides a simple wrapper around `ioredis` for NestJS, with automatic configuration loading.

## Installation

```bash
npm install @nest-boot/redis ioredis
# or
pnpm add @nest-boot/redis ioredis
```

## Setup

Register the `RedisModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({
      // Optional: configuration
      // host: 'localhost',
      // port: 6379,
    }),
  ],
})
export class AppModule {}
```

## Usage

Inject `Redis` (from `ioredis`) into your services.

```typescript
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class CacheService {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: string) {
    await this.redis.set(key, value);
  }

  async get(key: string) {
    return await this.redis.get(key);
  }
}
```

The module automatically loads configuration from environment variables:
- `REDIS_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_DB` or `REDIS_DATABASE`
- `REDIS_USER` or `REDIS_USERNAME`
- `REDIS_PASS` or `REDIS_PASSWORD`
