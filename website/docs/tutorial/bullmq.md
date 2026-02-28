---
sidebar_position: 8
---

# BullMQ

The `@nest-boot/bullmq` module provides job queue management powered by [BullMQ](https://docs.bullmq.io/), with automatic Redis connection configuration from environment variables.

## Installation

```bash
npm install @nest-boot/bullmq bullmq
# or
pnpm add @nest-boot/bullmq bullmq
```

## Basic Usage

### Module Registration

Register the `BullModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";

@Module({
  imports: [
    BullModule.forRoot({}),
    BullModule.registerQueue({ name: "email" }),
  ],
})
export class AppModule {}
```

### Async Registration

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nest-boot/bullmq";

@Module({
  imports: [
    ConfigModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST"),
          port: config.get("REDIS_PORT"),
        },
      }),
    }),
    BullModule.registerQueue({ name: "email" }),
  ],
})
export class AppModule {}
```

## Creating Workers

Create a worker class by extending `WorkerHost`:

```typescript
import { WorkerHost } from "@nest-boot/bullmq";
import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("email")
export class EmailProcessor extends WorkerHost {
  async process(job: Job<{ to: string; subject: string; body: string }>) {
    const { to, subject, body } = job.data;
    // Send email logic here
    console.log(`Sending email to ${to}: ${subject}`);
  }
}
```

Register the processor in your module:

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";
import { EmailProcessor } from "./email.processor";

@Module({
  imports: [BullModule.registerQueue({ name: "email" })],
  providers: [EmailProcessor],
})
export class EmailModule {}
```

## Adding Jobs to Queue

Inject the `Queue` to add jobs:

```typescript
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class EmailService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  async sendWelcomeEmail(to: string) {
    await this.emailQueue.add("welcome", {
      to,
      subject: "Welcome!",
      body: "Thanks for signing up.",
    });
  }

  async sendBulkEmails(emails: string[]) {
    const jobs = emails.map((to) => ({
      name: "newsletter",
      data: { to, subject: "Newsletter", body: "Latest news..." },
    }));

    await this.emailQueue.addBulk(jobs);
  }
}
```

## MikroORM Job Persistence

The `@nest-boot/bullmq-mikro-orm` package persists BullMQ job data to a MikroORM-managed database, enabling job history queries and dashboard integration.

### Installation

```bash
npm install @nest-boot/bullmq-mikro-orm
# or
pnpm add @nest-boot/bullmq-mikro-orm
```

### Usage

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nest-boot/bullmq";
import { BullMQMikroORMModule } from "@nest-boot/bullmq-mikro-orm";
import { JobEntity } from "@nest-boot/bullmq-mikro-orm";

@Module({
  imports: [
    BullModule.forRoot({}),
    BullMQMikroORMModule.forRoot({
      jobEntity: JobEntity,
    }),
  ],
})
export class AppModule {}
```

### How It Works

- Automatically listens to BullMQ queue and worker events (`waiting`, `active`, `completed`, `failed`)
- Upserts job data into the database on each state change
- Runs a cron job every hour to clean up jobs older than the configured TTL (default: 30 days)
- Supports filtering queues with `includeQueues` and `excludeQueues` options

### Configuration Options

| Option                   | Type                  | Description                                                 |
| ------------------------ | --------------------- | ----------------------------------------------------------- |
| `jobEntity`              | `EntityClass`         | The MikroORM entity class for jobs (required)               |
| `jobTTL`                 | `number`              | Time-to-live for job records in ms (default: 30 days)       |
| `includeQueues`          | `string[]`            | Only track these queues (empty = all)                       |
| `excludeQueues`          | `string[]`            | Exclude these queues from tracking                          |
| `convertJobToEntityData` | `(job) => EntityData` | Custom function to map additional job data to entity fields |

## Environment Variables

The module automatically loads Redis connection from environment variables when no `connection` option is provided:

| Variable         | Description               |
| ---------------- | ------------------------- |
| `REDIS_URL`      | Full Redis connection URL |
| `REDIS_HOST`     | Redis server hostname     |
| `REDIS_PORT`     | Redis server port         |
| `REDIS_DB`       | Redis database number     |
| `REDIS_PASSWORD` | Redis password            |

## API Reference

See the full API documentation for detailed information:

- [@nest-boot/bullmq](/docs/api/@nest-boot/bullmq)
- [@nest-boot/bullmq-mikro-orm](/docs/api/@nest-boot/bullmq-mikro-orm)

## Features

- **Auto Redis Config** - Automatically loads Redis connection from environment variables
- **Queue Registration** - Simple queue and flow producer registration
- **Worker Support** - `WorkerHost` base class for processing jobs
- **Job Persistence** - Optional MikroORM integration for job history
- **Queue Filtering** - Include/exclude specific queues from persistence
- **Auto Cleanup** - Configurable TTL with automatic old job cleanup
