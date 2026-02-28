---
sidebar_position: 12
---

# Logger

The `@nest-boot/logger` module provides structured, request-scoped logging powered by [Pino](https://getpino.io/), with automatic request correlation and HTTP logging.

## Installation

```bash
npm install @nest-boot/logger pino pino-http
# or
pnpm add @nest-boot/logger pino pino-http
```

## Basic Usage

### Module Registration

Register the `LoggerModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { LoggerModule } from "@nest-boot/logger";

@Module({
  imports: [LoggerModule.register({})],
})
export class AppModule {}
```

### Async Registration

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

## Using the Logger

Inject the `Logger` into any provider — it automatically inherits the parent class name as context:

```typescript
import { Injectable } from "@nestjs/common";
import { Logger } from "@nest-boot/logger";

@Injectable()
export class UserService {
  constructor(private readonly logger: Logger) {}

  async createUser(email: string) {
    this.logger.log("Creating user", { email });

    try {
      // ... create user
      this.logger.log("User created successfully");
    } catch (error) {
      this.logger.error("Failed to create user", { error });
      throw error;
    }
  }
}
```

## Log Levels

The logger supports standard log levels:

```typescript
this.logger.verbose("Trace-level message"); // trace
this.logger.debug("Debug information"); // debug
this.logger.log("Informational message"); // info
this.logger.warn("Warning message"); // warn
this.logger.error("Error message"); // error
```

## Adding Context

Use `assign()` to add structured data to all subsequent log entries in the current request:

```typescript
import { Injectable } from "@nestjs/common";
import { Logger } from "@nest-boot/logger";

@Injectable()
export class OrderService {
  constructor(private readonly logger: Logger) {}

  async processOrder(orderId: string, userId: string) {
    // Add order context to all logs in this request
    this.logger.assign({ orderId, userId });

    this.logger.log("Processing order");
    // Output: {"orderId": "123", "userId": "456", "msg": "Processing order"}

    await this.validateOrder(orderId);
    this.logger.log("Order validated");
    // Output: {"orderId": "123", "userId": "456", "msg": "Order validated"}
  }
}
```

## Default Configuration

The module provides these defaults:

- **Auto Logging**: Automatic HTTP request/response logging (can be disabled with `x-logging: false` header in non-production)
- **Redacted Fields**: `req.headers.authorization` and `req.headers.cookie` are redacted
- **Request ID**: Generated from request context ID or random UUID
- **Global Interceptor**: Automatically registers a logging interceptor

## Configuration Options

All [pino-http options](https://github.com/pinojs/pino-http) are supported, including:

| Option        | Type       | Description                         |
| ------------- | ---------- | ----------------------------------- |
| `level`       | `string`   | Minimum log level (default: `info`) |
| `transport`   | `object`   | Pino transport configuration        |
| `redact`      | `string[]` | Paths to redact from logs           |
| `autoLogging` | `object`   | Auto-logging configuration          |
| `genReqId`    | `function` | Custom request ID generator         |

## API Reference

See the full [API documentation](/docs/api/@nest-boot/logger) for detailed information.

## Features

- **Structured Logging** - JSON-formatted logs with Pino
- **Request-Scoped** - Each request gets its own logger context
- **Auto Correlation** - Request IDs automatically propagated
- **HTTP Logging** - Automatic request/response logging via pino-http
- **Context Propagation** - `assign()` adds data to all subsequent logs
- **Auto Context** - Logger automatically inherits the parent class name
- **Security** - Sensitive headers redacted by default
