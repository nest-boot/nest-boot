---
sidebar_position: 5
---

# Redis

`@nest-boot/redis` 模块使用 [ioredis](https://github.com/redis/ioredis) 提供 Redis 连接管理。它支持从环境变量自动配置和优雅关闭处理。

## 安装

```bash
npm install @nest-boot/redis ioredis
# 或
pnpm add @nest-boot/redis ioredis
```

## 基本用法

### 模块注册

在应用模块中注册 `RedisModule`：

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

### 使用环境变量

如果未提供选项，模块会自动从环境变量加载配置：

```typescript
import { Module } from "@nestjs/common";
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    // 将使用 REDIS_* 环境变量
    RedisModule.register({ isGlobal: true }),
  ],
})
export class AppModule {}
```

### 异步注册

从其他服务获取配置：

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

## 使用 Redis 客户端

直接将 `Redis` 客户端注入到你的服务中：

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

## 示例：会话存储

```typescript
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class SessionService {
  private readonly prefix = "session:";
  private readonly ttl = 3600; // 1 小时

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

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/redis) 获取详细信息。

## 环境变量

模块支持从以下环境变量自动配置：

| 变量                             | 描述                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`                      | 完整的 Redis 连接 URL（例如 `redis://user:pass@host:6379/0`）。优先于单独设置。使用 `rediss://` 启用 TLS。 |
| `REDIS_HOST`                     | Redis 服务器主机名                                                                                         |
| `REDIS_PORT`                     | Redis 服务器端口                                                                                           |
| `REDIS_DB` 或 `REDIS_DATABASE`   | Redis 数据库编号                                                                                           |
| `REDIS_USER` 或 `REDIS_USERNAME` | Redis 用户名                                                                                               |
| `REDIS_PASS` 或 `REDIS_PASSWORD` | Redis 密码                                                                                                 |
| `REDIS_TLS`                      | 启用 TLS 连接（任何真值）                                                                                  |

## 配置选项

支持所有 [ioredis RedisOptions](https://redis.github.io/ioredis/index.html#RedisOptions)，包括：

| 选项            | 类型       | 描述                           |
| --------------- | ---------- | ------------------------------ |
| `host`          | `string`   | Redis 服务器主机名             |
| `port`          | `number`   | Redis 服务器端口（默认：6379） |
| `db`            | `number`   | Redis 数据库编号               |
| `username`      | `string`   | Redis 用户名                   |
| `password`      | `string`   | Redis 密码                     |
| `tls`           | `object`   | TLS 连接选项                   |
| `keyPrefix`     | `string`   | 添加到所有键的前缀             |
| `retryStrategy` | `function` | 自定义重试策略                 |

## 特性

- **自动配置** - 自动从环境变量加载设置
- **全局模块** - 可以使用 `isGlobal: true` 注册为全局模块
- **优雅关闭** - 应用关闭时自动关闭 Redis 连接
- **完整 ioredis 支持** - 访问所有 ioredis 功能（发布/订阅、流、管道等）
