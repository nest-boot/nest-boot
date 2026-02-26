---
sidebar_position: 1
---

# Schedule

`@nest-boot/schedule` 模块提供了一个基于 BullMQ 的分布式任务调度器。它允许你使用 Cron 表达式或时间间隔来调度任务，并确保它们在你的应用程序实例之间分布式运行。

## 安装

```bash
npm install @nest-boot/schedule
# or
pnpm add @nest-boot/schedule
```

## 配置

在你的应用程序模块中注册 `ScheduleModule`。

```typescript
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nest-boot/schedule";

@Module({
  imports: [
    ScheduleModule.forRoot({
      // 可选：配置
    }),
  ],
})
export class AppModule {}
```

## 使用

使用 `@Cron` 或 `@Interval` 装饰器来调度方法。

### Cron 任务

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nest-boot/schedule";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  @Cron("45 * * * * *")
  handleCron() {
    this.logger.debug("Called when the current second is 45");
  }
}
```

### 间隔任务

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nest-boot/schedule";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  @Interval(10000)
  handleInterval() {
    this.logger.debug("Called every 10 seconds");
  }
}
```

调度器使用一个专用的 BullMQ 队列 (`schedule`) 来管理这些作业，确保可靠性和分布式执行。
