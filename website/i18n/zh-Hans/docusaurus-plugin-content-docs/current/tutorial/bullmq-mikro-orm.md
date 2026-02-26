---
sidebar_position: 2
---

# BullMQ MikroORM

`@nest-boot/bullmq-mikro-orm` 模块使用 MikroORM 将 BullMQ 作业数据和状态持久化到数据库中。这对于监控、审计和调试后台作业非常有用。

## 安装

```bash
npm install @nest-boot/bullmq-mikro-orm
# or
pnpm add @nest-boot/bullmq-mikro-orm
```

## 配置

首先，定义一个继承自 `@nest-boot/bullmq-mikro-orm` 中 `JobEntity` 的作业实体。

```typescript
import { Entity } from "@mikro-orm/core";
import { JobEntity } from "@nest-boot/bullmq-mikro-orm";

@Entity({ tableName: "bullmq_job" })
export class Job extends JobEntity {}
```

然后在你的应用程序中注册该模块。

```typescript
import { Module } from "@nestjs/common";
import { BullMQMikroORMModule } from "@nest-boot/bullmq-mikro-orm";
import { Job } from "./job.entity";

@Module({
  imports: [
    BullMQMikroORMModule.forRoot({
      jobEntity: Job,
      // 可选：作业保留时间，默认为 30 天（毫秒）
    }),
  ],
})
export class AppModule {}
```

## 使用

该模块会自动监听 BullMQ 事件（waiting, active, completed, failed 等），并将作业信息插入或更新到你的数据库中。

你可以使用标准的 MikroORM 存储库查询 `Job` 实体，以构建自定义仪表板或监控工具。

### 配置选项

- `jobEntity`: 要使用的 MikroORM 实体类。
- `jobTTL`: 数据库中作业记录的生存时间（默认：30 天）。旧作业将由计划任务自动清理。
- `includeQueues`: 要监控的队列名称数组。
- `excludeQueues`: 要排除的队列名称数组。
