---
sidebar_position: 8
---

# BullMQ

`@nest-boot/bullmq` 模块提供基于 [BullMQ](https://docs.bullmq.io/) 的作业队列管理，支持从环境变量自动配置 Redis 连接。

## 安装

```bash
npm install @nest-boot/bullmq bullmq
# 或
pnpm add @nest-boot/bullmq bullmq
```

## 基本用法

### 模块注册

在应用模块中注册 `BullModule`：

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

### 异步注册

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

## 创建 Worker

通过继承 `WorkerHost` 创建 Worker 类：

```typescript
import { WorkerHost } from "@nest-boot/bullmq";
import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("email")
export class EmailProcessor extends WorkerHost {
  async process(job: Job<{ to: string; subject: string; body: string }>) {
    const { to, subject, body } = job.data;
    // 发送邮件逻辑
    console.log(`Sending email to ${to}: ${subject}`);
  }
}
```

在模块中注册处理器：

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

## 添加作业到队列

注入 `Queue` 添加作业：

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

## MikroORM 作业持久化

`@nest-boot/bullmq-mikro-orm` 包将 BullMQ 作业数据持久化到 MikroORM 管理的数据库，支持作业历史查询和仪表盘集成。

### 安装

```bash
npm install @nest-boot/bullmq-mikro-orm
# 或
pnpm add @nest-boot/bullmq-mikro-orm
```

### 用法

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

### 工作原理

- 自动监听 BullMQ 队列和 Worker 事件（`waiting`、`active`、`completed`、`failed`）
- 每次状态变更时将作业数据 upsert 到数据库
- 每小时运行定时任务清理超过配置 TTL 的旧作业（默认：30 天）
- 支持通过 `includeQueues` 和 `excludeQueues` 选项过滤队列

### 配置选项

| 选项                     | 类型                  | 描述                                     |
| ------------------------ | --------------------- | ---------------------------------------- |
| `jobEntity`              | `EntityClass`         | 作业的 MikroORM 实体类（必填）           |
| `jobTTL`                 | `number`              | 作业记录保留时间，毫秒（默认：30 天）    |
| `includeQueues`          | `string[]`            | 仅跟踪这些队列（空 = 全部）              |
| `excludeQueues`          | `string[]`            | 排除这些队列不进行跟踪                   |
| `convertJobToEntityData` | `(job) => EntityData` | 自定义函数，将额外作业数据映射到实体字段 |

## 环境变量

未提供 `connection` 选项时，模块自动从环境变量加载 Redis 连接：

| 变量             | 描述                  |
| ---------------- | --------------------- |
| `REDIS_URL`      | 完整的 Redis 连接 URL |
| `REDIS_HOST`     | Redis 服务器主机名    |
| `REDIS_PORT`     | Redis 服务器端口      |
| `REDIS_DB`       | Redis 数据库编号      |
| `REDIS_PASSWORD` | Redis 密码            |

## API 参考

查看完整的 API 文档获取详细信息：

- [@nest-boot/bullmq](/docs/api/@nest-boot/bullmq)
- [@nest-boot/bullmq-mikro-orm](/docs/api/@nest-boot/bullmq-mikro-orm)

## 特性

- **自动 Redis 配置** - 从环境变量自动加载 Redis 连接
- **队列注册** - 简单的队列和 Flow Producer 注册
- **Worker 支持** - `WorkerHost` 基类用于处理作业
- **作业持久化** - 可选的 MikroORM 集成用于作业历史
- **队列过滤** - 包含/排除特定队列的持久化
- **自动清理** - 可配置 TTL，自动清理旧作业
