---
sidebar_position: 12
---

# 日志

`@nest-boot/logger` 模块提供基于 [Pino](https://getpino.io/) 的结构化、请求作用域日志，支持自动请求关联和 HTTP 日志。

## 安装

```bash
npm install @nest-boot/logger pino pino-http
# 或
pnpm add @nest-boot/logger pino pino-http
```

## 基本用法

### 模块注册

在应用模块中注册 `LoggerModule`：

```typescript
import { Module } from "@nestjs/common";
import { LoggerModule } from "@nest-boot/logger";

@Module({
  imports: [LoggerModule.register({})],
})
export class AppModule {}
```

### 异步注册

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "@nest-boot/logger";

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        level: config.get("LOG_LEVEL", "info"),
      }),
    }),
  ],
})
export class AppModule {}
```

## 使用日志器

将 `Logger` 注入到任意提供者 — 它会自动继承父类名称作为上下文：

```typescript
import { Injectable } from "@nestjs/common";
import { Logger } from "@nest-boot/logger";

@Injectable()
export class UserService {
  constructor(private readonly logger: Logger) {}

  async createUser(email: string) {
    this.logger.log("Creating user", { email });

    try {
      // ... 创建用户
      this.logger.log("User created successfully");
    } catch (error) {
      this.logger.error("Failed to create user", { error });
      throw error;
    }
  }
}
```

## 日志级别

日志器支持标准日志级别：

```typescript
this.logger.verbose("Trace 级别消息"); // trace
this.logger.debug("调试信息"); // debug
this.logger.log("信息消息"); // info
this.logger.warn("警告消息"); // warn
this.logger.error("错误消息"); // error
```

## 添加上下文

使用 `assign()` 将结构化数据添加到当前请求的所有后续日志条目中：

```typescript
import { Injectable } from "@nestjs/common";
import { Logger } from "@nest-boot/logger";

@Injectable()
export class OrderService {
  constructor(private readonly logger: Logger) {}

  async processOrder(orderId: string, userId: string) {
    // 将订单上下文添加到此请求的所有日志中
    this.logger.assign({ orderId, userId });

    this.logger.log("Processing order");
    // 输出: {"orderId": "123", "userId": "456", "msg": "Processing order"}

    await this.validateOrder(orderId);
    this.logger.log("Order validated");
    // 输出: {"orderId": "123", "userId": "456", "msg": "Order validated"}
  }
}
```

## 默认配置

模块提供以下默认值：

- **自动日志**：自动记录 HTTP 请求/响应（非生产环境可通过 `x-logging: false` 头禁用）
- **脱敏字段**：`req.headers.authorization` 和 `req.headers.cookie` 自动脱敏
- **请求 ID**：从请求上下文 ID 或随机 UUID 生成
- **全局拦截器**：自动注册日志拦截器

## 配置选项

支持所有 [pino-http 选项](https://github.com/pinojs/pino-http)，包括：

| 选项          | 类型       | 描述                         |
| ------------- | ---------- | ---------------------------- |
| `level`       | `string`   | 最低日志级别（默认：`info`） |
| `transport`   | `object`   | Pino transport 配置          |
| `redact`      | `string[]` | 需要脱敏的日志路径           |
| `autoLogging` | `object`   | 自动日志配置                 |
| `genReqId`    | `function` | 自定义请求 ID 生成器         |

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/logger) 获取详细信息。

## 特性

- **结构化日志** - 基于 Pino 的 JSON 格式日志
- **请求作用域** - 每个请求拥有独立的日志上下文
- **自动关联** - 请求 ID 自动传播
- **HTTP 日志** - 通过 pino-http 自动记录请求/响应
- **上下文传播** - `assign()` 将数据添加到所有后续日志
- **自动上下文** - 日志器自动继承父类名称
- **安全性** - 敏感头信息默认脱敏
