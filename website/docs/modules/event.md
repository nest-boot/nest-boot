---
sidebar_position: 5
---

# 事件

EventEmitterModule 提供了一个简单的观察者实现，允许您订阅和监听应用程序中发生的各种事件。事件是解耦应用程序各个方面的好方法，因为单个事件可以有多个互不依赖的侦听器。

## 安装

首先安装所需的包:

```shell
$ npm i --save @nest-boot/event-emitter ioredis
```

安装完成后，将 EventEmitterModule 导入到根模块，如下所示：

```typescript
import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nest-boot/event-emitter";

@Module({
  imports: [EventEmitterModule.forRoot()],
})
export class AppModule {}
```

要配置底层 Redis 实例，请将配置对象传递给该 `forRoot()` 方法，如下所示：

```typescript
EventEmitterModule.forRoot({
  host: "localhost",
  port: 6379,
});
```

也可以使用 `forRootAsync()` 方法来配置 `EventEmitterModule`，如下所示：

```typescript
EventEmitterModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    host: configService.get("REDIS_HOST"),
    port: configService.get("REDIS_PORT"),
  }),
});
```

## 触发事件

如果要要触发事件，首先使用标准构造函数注入注入 `EventEmitter`：

```typescript
import { Injectable } from "@nestjs/common";
import { EventEmitter } from "@nest-boot/event-emitter";

@Injectable()
class OrderService {
  constructor(private readonly eventEmitter: EventEmitter) {}
}
```

然后在类中使用它，如下所示:

```typescript
this.eventEmitter.emit(
  "order.created",
  new OrderCreatedEvent({
    orderId: 1,
    payload: {},
  }),
);
```

## 监听事件

要声明事件侦听器，请在包含要执行的代码的方法定义之前使用 `@OnEvent()` 装饰器装饰方法，如下所示：

```typescript
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nest-boot/event-emitter";

@Injectable()
class OrderListener {
  @OnEvent("order.created")
  handleOrderCreatedEvent(payload: OrderCreatedEvent) {
    //
  }
}
```
