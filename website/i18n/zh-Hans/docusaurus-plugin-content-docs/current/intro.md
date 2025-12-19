---
sidebar_position: 1
---

# 介绍

Nest Boot 是一个用于构建 NestJS 应用程序的模块化框架。它提供了一系列可重用的模块，帮助你更快地构建健壮、可扩展的应用程序。

## 特性

- **模块化架构** - 按需选择所需的模块
- **TypeScript 优先** - 使用 TypeScript 构建，提供类型安全和更好的开发体验
- **生产就绪** - 经过生产环境验证的模块
- **文档完善** - 提供全面的文档和示例

## 模块

Nest Boot 提供以下模块：

| 模块                                                                     | 描述                       |
| ------------------------------------------------------------------------ | -------------------------- |
| [@nest-boot/auth](/docs/api/@nest-boot/auth)                             | 身份验证和授权             |
| [@nest-boot/bullmq](/docs/api/@nest-boot/bullmq)                         | 使用 BullMQ 的作业队列管理 |
| [@nest-boot/crypt](/docs/tutorial/crypt)                                 | 加密和解密工具             |
| [@nest-boot/graphql](/docs/api/@nest-boot/graphql)                       | GraphQL 集成               |
| [@nest-boot/graphql-connection](/docs/api/@nest-boot/graphql-connection) | GraphQL 连接/分页          |
| [@nest-boot/hash](/docs/tutorial/hash)                                   | 密码哈希工具               |
| [@nest-boot/i18n](/docs/api/@nest-boot/i18n)                             | 国际化                     |
| [@nest-boot/logger](/docs/api/@nest-boot/logger)                         | 日志工具                   |
| [@nest-boot/mailer](/docs/api/@nest-boot/mailer)                         | 邮件发送                   |
| [@nest-boot/metrics](/docs/api/@nest-boot/metrics)                       | 应用指标                   |
| [@nest-boot/middleware](/docs/tutorial/middleware)                       | 中间件管理                 |
| [@nest-boot/mikro-orm](/docs/api/@nest-boot/mikro-orm)                   | MikroORM 集成              |
| [@nest-boot/redis](/docs/tutorial/redis)                                 | Redis 客户端               |
| [@nest-boot/request-context](/docs/api/@nest-boot/request-context)       | 请求上下文管理             |
| [@nest-boot/schedule](/docs/api/@nest-boot/schedule)                     | 任务调度                   |
| [@nest-boot/validator](/docs/api/@nest-boot/validator)                   | 验证工具                   |
| [@nest-boot/view](/docs/api/@nest-boot/view)                             | 视图渲染                   |

## 快速开始

安装所需的模块：

```bash
npm install @nest-boot/hash @nest-boot/crypt
# 或
pnpm add @nest-boot/hash @nest-boot/crypt
```

然后在你的 NestJS 应用程序中导入并注册它们：

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    HashModule.register(),
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
  ],
})
export class AppModule {}
```

## 下一步

- 浏览[教程](/docs/tutorial/hash)了解如何使用特定模块
- 查看 [API 参考](/docs/api)获取详细文档
