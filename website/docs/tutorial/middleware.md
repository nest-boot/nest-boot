---
sidebar_position: 1
---

# Middleware

The `@nest-boot/middleware` module provides a flexible way to manage middlewares in NestJS applications, allowing dynamic configuration and dependencies.

## Installation

```bash
npm install @nest-boot/middleware
# or
pnpm add @nest-boot/middleware
```

## Setup

Register the `MiddlewareModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { MiddlewareModule } from "@nest-boot/middleware";

@Module({
  imports: [MiddlewareModule],
})
export class AppModule {}
```

## Usage

Inject `MiddlewareManager` to dynamically register middlewares.

```typescript
import { Injectable, NestMiddleware, Inject } from "@nestjs/common";
import { MiddlewareManager } from "@nest-boot/middleware";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class MyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log("Request...");
    next();
  }
}

@Injectable()
export class AppService {
  constructor(private readonly middlewareManager: MiddlewareManager, private readonly myMiddleware: MyMiddleware) {
    this.middlewareManager
      .apply(this.myMiddleware)
      .forRoutes("*");
  }
}
```

### Dependencies

You can declare dependencies between middlewares using `.dependencies()`. This ensures that dependency middlewares run before the dependent middleware.

```typescript
this.middlewareManager
  .apply(this.authMiddleware)
  .dependencies(RequestContextMiddleware)
  .forRoutes("*");
```

### Global Exclusion

You can globally exclude certain routes from all middlewares managed by the manager.

```typescript
this.middlewareManager.globalExclude("/health");
```
