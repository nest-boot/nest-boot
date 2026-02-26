---
sidebar_position: 1
---

# BullMQ

`@nest-boot/bullmq` 模块提供了与 [BullMQ](https://docs.bullmq.io/) 的集成，用于在 NestJS 中处理分布式作业和消息。

## 安装

```bash
npm install @nest-boot/bullmq bullmq
# or
pnpm add @nest-boot/bullmq bullmq
```

## 配置

在你的应用程序模块中注册 `BullModule`。它会自动从环境变量加载 Redis 配置（例如 `REDIS_URL` 或 `REDIS_HOST`、`REDIS_PORT` 等）。

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";

@Module({
  imports: [
    BullModule.forRoot({
      // 可选：覆盖连接选项
      // connection: { ... }
    }),
  ],
})
export class AppModule {}
```

## 使用

### 注册队列

使用 `BullModule.registerQueue` 来注册队列。

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "audio",
    }),
  ],
})
export class AudioModule {}
```

### 处理器 (Processors)

使用 `@nest-boot/bullmq` 提供的 `@Processor` 装饰器，而不是 `@nestjs/bullmq`。这个增强的装饰器确保每个作业都在一个 `RequestContext` 中运行，这对于日志记录、追踪和隔离非常有用。

```typescript
import { Processor, WorkerHost } from "@nest-boot/bullmq";
import { Job } from "bullmq";

@Processor("audio")
export class AudioProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(job.data);
    // ...
  }
}
```

### 注入队列

使用 `@InjectQueue` 注入队列实例。

```typescript
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class AudioService {
  constructor(@InjectQueue("audio") private audioQueue: Queue) {}

  async transcode() {
    await this.audioQueue.add("transcode", {
      file: "audio.mp3",
    });
  }
}
```
