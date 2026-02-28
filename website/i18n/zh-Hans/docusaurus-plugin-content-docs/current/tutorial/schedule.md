---
sidebar_position: 9
---

# 定时任务

`@nest-boot/schedule` 模块提供基于 BullMQ 的类 cron 作业调度，支持装饰器注册定时任务。

## 安装

```bash
npm install @nest-boot/schedule @nest-boot/bullmq
# 或
pnpm add @nest-boot/schedule @nest-boot/bullmq
```

## 基本用法

### 模块注册

将 `ScheduleModule` 与 `BullModule` 一起注册：

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";
import { ScheduleModule } from "@nest-boot/schedule";

@Module({
  imports: [BullModule.forRoot({}), ScheduleModule.forRoot({})],
})
export class AppModule {}
```

### 异步注册

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";
import { ScheduleModule } from "@nest-boot/schedule";

@Module({
  imports: [
    BullModule.forRoot({}),
    ScheduleModule.forRootAsync({
      useFactory: () => ({
        concurrency: 5,
      }),
    }),
  ],
})
export class AppModule {}
```

## 定义定时任务

### Cron 任务

使用 `@Cron()` 装饰器通过 cron 表达式调度方法：

```typescript
import { Injectable } from "@nestjs/common";
import { Cron } from "@nest-boot/schedule";

@Injectable()
export class TaskService {
  @Cron("0 * * * *") // 每小时
  async cleanupExpiredSessions() {
    // 清理过期会话
  }

  @Cron("0 0 * * *") // 每天午夜
  async generateDailyReport() {
    // 生成日报
  }

  @Cron("0 9 * * 1", { timezone: "Asia/Shanghai" })
  async weeklyDigest() {
    // 每周一上午 9 点（北京时间）发送周报
  }
}
```

### 定时间隔任务

使用 `@Interval()` 装饰器设置固定间隔的重复任务：

```typescript
import { Injectable } from "@nestjs/common";
import { Interval } from "@nest-boot/schedule";

@Injectable()
export class HealthCheckService {
  @Interval(30000) // 每 30 秒
  async checkHealth() {
    // 执行健康检查
  }

  @Interval("5m") // 每 5 分钟（字符串格式）
  async syncData() {
    // 从外部服务同步数据
  }
}
```

### 通用 Schedule 装饰器

使用 `@Schedule()` 装饰器进行完全控制：

```typescript
import { Injectable } from "@nestjs/common";
import { Schedule } from "@nest-boot/schedule";

@Injectable()
export class TaskService {
  @Schedule({ type: "cron", value: "*/5 * * * *" })
  async everyFiveMinutes() {
    // 每 5 分钟运行
  }

  @Schedule({ type: "interval", value: 60000 })
  async everyMinute() {
    // 每分钟运行
  }
}
```

## 配置选项

| 选项          | 类型     | 描述                                 |
| ------------- | -------- | ------------------------------------ |
| `concurrency` | `number` | 并发处理的作业数（默认：1）          |
| `connection`  | `object` | Redis 连接选项（从 BullModule 继承） |

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/schedule) 获取详细信息。

## 特性

- **Cron 调度** - 标准 cron 表达式，支持时区
- **间隔调度** - 固定间隔的重复任务
- **装饰器驱动** - 简单的 `@Cron()` 和 `@Interval()` 装饰器
- **BullMQ 驱动** - 基于 Redis 的可靠作业处理
- **自动发现** - 自动注册被装饰的方法
- **可配置并发** - 控制并行作业执行
