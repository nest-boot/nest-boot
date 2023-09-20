---
sidebar_position: 10
---

# 队列 Queue

## 安装依赖

```shell
npm i @nest-boot/queue @nest-boot/request-context bullmq ioredis
```

## 注册模块

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QueueModule } from "@nest-boot/queue";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule.registerAsync({
      name: "audio",
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          username: configService.get("REDIS_USERNAME"),
          password: configService.get("REDIS_PASSWORD"),
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## 生产者

要添加作业到队列，您需要使用 `Queue` 实例。您可以通过 `@InjectQueue()` 装饰器来注入 `Queue` 实例。

```typescript
import { Controller, Post } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "./inject-queue.decorator";

@Controller("audio")
export class TaskService {
  constructor(
    @InjectQueue("audio")
    private readonly queue: Queue,
  ) {}

  @Post("transcode")
  async transcode() {
    await this.queue.add("transcode", {
      file: "audio.mp3",
    });
  }
}
```

## 消费者

使用 `@Consumer()` 装饰器声明一个消费者类，如下所示：

```typescript
import { Logger } from "@nestjs/common";
import { Job, Consumer, QueueConsumer } from "@nest-boot/queue";

@Consumer("audio")
export class AudioConsumer implements QueueConsumer {
  private readonly logger = new Logger(TranscodeConsumer.name);

  consume(job: Job) {
    this.logger.debug("Start transcoding...");
    this.logger.debug(job.data);
    this.logger.debug("Transcoding completed");
  }
}
```

## 请求范围的消费者

当消费者被标记为请求范围时，将为每个作业专门创建该类的一个新实例。作业完成后，实例将被垃圾回收。
并且由于请求范围的使用者类是动态实例化的，并且范围仅限于单个作业，因此您可以通过构造函数使用 `@Inject(REQUEST)` 注入作业实例。

```typescript
import { Logger, REQUEST } from "@nestjs/common";
import { Job, Consumer, Consumer } from "@nest-boot/queue";

@Consumer("audio", { scope: Scope.REQUEST })
export class AudioConsumer {
  private readonly logger = new Logger(TranscodeConsumer.name);

  constructor(@Inject(REQUEST) job: Job) {}

  consume() {
    this.logger.debug("Start transcoding...");
    this.logger.debug(this.job.data);
    this.logger.debug("Transcoding completed");
  }
}
```

## 示例
