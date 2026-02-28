---
sidebar_position: 9
---

# Schedule

The `@nest-boot/schedule` module provides cron-like job scheduling powered by BullMQ, with decorator-based schedule registration.

## Installation

```bash
npm install @nest-boot/schedule @nest-boot/bullmq
# or
pnpm add @nest-boot/schedule @nest-boot/bullmq
```

## Basic Usage

### Module Registration

Register the `ScheduleModule` along with `BullModule`:

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";
import { ScheduleModule } from "@nest-boot/schedule";

@Module({
  imports: [BullModule.forRoot({}), ScheduleModule.forRoot({})],
})
export class AppModule {}
```

### Async Registration

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

## Defining Schedules

### Cron Jobs

Use the `@Cron()` decorator to schedule methods with cron expressions:

```typescript
import { Injectable } from "@nestjs/common";
import { Cron } from "@nest-boot/schedule";

@Injectable()
export class TaskService {
  @Cron("0 * * * *") // Every hour
  async cleanupExpiredSessions() {
    // Clean up expired sessions
  }

  @Cron("0 0 * * *") // Every day at midnight
  async generateDailyReport() {
    // Generate daily report
  }

  @Cron("0 9 * * 1", { timezone: "Asia/Shanghai" })
  async weeklyDigest() {
    // Send weekly digest every Monday at 9 AM CST
  }
}
```

### Interval Jobs

Use the `@Interval()` decorator for recurring jobs at fixed intervals:

```typescript
import { Injectable } from "@nestjs/common";
import { Interval } from "@nest-boot/schedule";

@Injectable()
export class HealthCheckService {
  @Interval(30000) // Every 30 seconds
  async checkHealth() {
    // Perform health check
  }

  @Interval("5m") // Every 5 minutes (string format)
  async syncData() {
    // Sync data from external service
  }
}
```

### Generic Schedule Decorator

Use the `@Schedule()` decorator for full control:

```typescript
import { Injectable } from "@nestjs/common";
import { Schedule } from "@nest-boot/schedule";

@Injectable()
export class TaskService {
  @Schedule({ type: "cron", value: "*/5 * * * *" })
  async everyFiveMinutes() {
    // Runs every 5 minutes
  }

  @Schedule({ type: "interval", value: 60000 })
  async everyMinute() {
    // Runs every minute
  }
}
```

## Configuration Options

| Option        | Type     | Description                                          |
| ------------- | -------- | ---------------------------------------------------- |
| `concurrency` | `number` | Number of concurrent jobs to process (default: 1)    |
| `connection`  | `object` | Redis connection options (inherited from BullModule) |

## API Reference

See the full [API documentation](/docs/api/@nest-boot/schedule) for detailed information.

## Features

- **Cron Scheduling** - Standard cron expressions with timezone support
- **Interval Scheduling** - Fixed-interval recurring jobs
- **Decorator-Based** - Simple `@Cron()` and `@Interval()` decorators
- **BullMQ Powered** - Reliable job processing with Redis-backed queues
- **Auto Discovery** - Automatic registration of decorated methods
- **Configurable Concurrency** - Control parallel job execution
