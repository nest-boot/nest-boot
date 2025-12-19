---
sidebar_position: 3
---

# Middleware Module

The `@nest-boot/middleware` module provides a centralized and flexible way to manage middleware registration in NestJS applications. It supports dependency ordering, route exclusions, and global configuration.

## Installation

```bash
npm install @nest-boot/middleware
# or
pnpm add @nest-boot/middleware
```

## Basic Usage

### Module Registration

Import the `MiddlewareModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { MiddlewareModule } from "@nest-boot/middleware";

@Module({
  imports: [MiddlewareModule],
})
export class AppModule {}
```

### Using MiddlewareManager

Inject the `MiddlewareManager` and register middlewares using the fluent API:

```typescript
import { Injectable, NestMiddleware, OnModuleInit } from "@nestjs/common";
import { MiddlewareManager } from "@nest-boot/middleware";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    console.log(`Request: ${req.method} ${req.url}`);
    next();
  }
}

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly loggerMiddleware: LoggerMiddleware,
  ) {}

  onModuleInit() {
    this.middlewareManager.apply(this.loggerMiddleware).forRoutes("*");
  }
}
```

## Fluent API

### Applying Middleware

```typescript
middlewareManager
  .apply(middleware1, middleware2)
  .forRoutes("users", "products");
```

### Excluding Routes

```typescript
middlewareManager
  .apply(authMiddleware)
  .exclude("health", { path: "auth/login", method: RequestMethod.POST })
  .forRoutes("*");
```

### Global Route Exclusions

Set routes that should be excluded from all middlewares:

```typescript
middlewareManager.globalExclude("health", "metrics");

// All middlewares registered after this will exclude these routes
middlewareManager.apply(middleware1).forRoutes("*");
```

### Disabling Global Exclusions for Specific Middleware

```typescript
middlewareManager
  .apply(metricsMiddleware)
  .disableGlobalExcludeRoutes()
  .forRoutes("*");
```

### Middleware Dependencies

Ensure middlewares execute in a specific order:

```typescript
@Injectable()
class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // Authentication logic
    next();
  }
}

@Injectable()
class RateLimitMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // Rate limiting logic (needs auth info)
    next();
  }
}

// RateLimitMiddleware will always run after AuthMiddleware
middlewareManager
  .apply(rateLimitMiddleware)
  .dependencies(AuthMiddleware)
  .forRoutes("*");

middlewareManager.apply(authMiddleware).forRoutes("*");
```

## Complete Example

```typescript
import {
  Module,
  Injectable,
  NestMiddleware,
  OnModuleInit,
} from "@nestjs/common";
import { MiddlewareModule, MiddlewareManager } from "@nest-boot/middleware";

@Injectable()
class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  }
}

@Injectable()
class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // Check authentication
    const token = req.headers.authorization;
    if (token) {
      req.user = { id: "123" }; // Simplified
    }
    next();
  }
}

@Injectable()
class MiddlewareSetup implements OnModuleInit {
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly loggerMiddleware: LoggerMiddleware,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  onModuleInit() {
    // Global exclusions
    this.middlewareManager.globalExclude("health", "metrics");

    // Logger runs on all routes
    this.middlewareManager.apply(this.loggerMiddleware).forRoutes("*");

    // Auth runs on protected routes, after logger
    this.middlewareManager
      .apply(this.authMiddleware)
      .dependencies(LoggerMiddleware)
      .exclude("auth/login", "auth/register")
      .forRoutes("*");
  }
}

@Module({
  imports: [MiddlewareModule],
  providers: [LoggerMiddleware, AuthMiddleware, MiddlewareSetup],
})
export class AppModule {}
```

## API Reference

See the full [API documentation](/docs/api/@nest-boot/middleware) for detailed information.

## Features

- **Centralized Management** - Register all middlewares in one place
- **Dependency Ordering** - Automatically sort middlewares based on dependencies
- **Circular Dependency Detection** - Throws error if circular dependencies are detected
- **Global Exclusions** - Define routes excluded from all middlewares
- **Per-Middleware Exclusions** - Fine-grained control over route exclusions
- **Fluent API** - Clean, chainable configuration syntax
