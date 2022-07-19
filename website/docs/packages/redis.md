---
sidebar_position: 1
---

# Redis

## 安装

从安装所需的软件包开始：

```bash
npm i @nest-boot/redis ioredis
```

安装过程完成后，我们可以将其 `RedisModule` 导入到根目录 `AppModule` 中。

```typescript
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({
      host: "localhost",
      port: 6379,
      password: "secret",
    }),
    // ...
  ],
  // ...
})
export class AppModule {}
```

完成模块注册后 Redis 实例就可以在 Service 进行注入：

```typescript
import { Redis } from "@nest-boot/redis";

@Injectable()
export class AppService {
  constructor(private redis: Redis) {}
}
```

## 异步配置

您可能希望以异步方式而不是静态方式传递模块选项，在这种情况下可以使用 `registerAsync()` 方法。

```typescript
RedisModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    host: configService.get("REDIS_HOST"),
    port: +configService.get("REDIS_PORT"),
    password: configService.get("REDIS_PASSWORD"),
  }),
});
```

## 多个 Redis 实例

可以在 `RedisModule` 选项中添加 name 参数来导入多个不同的 `RedisModule`。

```typescript
import { RedisModule } from "@nest-boot/redis";

@Module({
  imports: [
    RedisModule.register({
      name: "instance-1",
      host: "localhost",
      port: 16379,
      password: "secret",
    }),
    RedisModule.register({
      name: "instance-2",
      host: "localhost",
      port: 26379,
      password: "secret",
    }),
    // ...
  ],
  // ...
})
export class AppModule {}
```

之后使用 `@InjectRedis(name)` 装饰器来选择不同的实例。

```typescript
import { Redis } from "@nest-boot/redis";

@Injectable()
export class AppService {
  constructor(
    @InjectRedis("instance-1")
    private redis1: Redis,
    @InjectRedis("instance-2")
    private redis2: Redis
  ) {}
}
```
