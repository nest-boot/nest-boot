---
sidebar_position: 2
---

# Redis

`@nest-boot/redis` 模块为 NestJS 提供了一个简单的 `ioredis` 封装，支持自动配置加载。

## 安装

```bash
npm install @nest-boot/redis ioredis
# or
pnpm add @nest-boot/redis ioredis
```

## 配置

在你的应用程序模块中注册 `RedisModule`。

```typescript
import { Module } from "@nestjs/common";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({
      // 可选：配置
      // host: 'localhost',
      // port: 6379,
    }),
  ],
})
export class AppModule {}
```

## 使用

将 `Redis` (来自 `ioredis`) 注入到你的服务中。

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

该模块自动从环境变量加载配置：

- `REDIS_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_DB` 或 `REDIS_DATABASE`
- `REDIS_USER` 或 `REDIS_USERNAME`
- `REDIS_PASS` 或 `REDIS_PASSWORD`
