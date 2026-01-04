---
sidebar_position: 6
---

# Request Context

The `@nest-boot/request-context` module provides request-scoped storage using Node.js AsyncLocalStorage. It allows you to store and access data throughout the lifecycle of a request without passing it through every function call.

## Installation

```bash
npm install @nest-boot/request-context @nest-boot/middleware
# or
pnpm add @nest-boot/request-context @nest-boot/middleware
```

## Basic Usage

### Module Registration

Register the `RequestContextModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { RequestContextModule } from "@nest-boot/request-context";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```

The module is global, so you only need to import it once.

### Storing and Retrieving Data

Use the static methods to interact with the current request context:

```typescript
import { Injectable } from "@nestjs/common";
import { RequestContext } from "@nest-boot/request-context";

@Injectable()
export class UserService {
  setCurrentUser(user: User) {
    RequestContext.set("currentUser", user);
  }

  getCurrentUser(): User | undefined {
    return RequestContext.get<User>("currentUser");
  }
}
```

### Accessing Request ID

Each context has a unique ID, which can be used for logging and tracing:

```typescript
import { Injectable } from "@nestjs/common";
import { RequestContext } from "@nest-boot/request-context";

@Injectable()
export class LoggingService {
  log(message: string) {
    const requestId = RequestContext.id;
    console.log(`[${requestId}] ${message}`);
  }
}
```

## Accessing HTTP Request/Response

The module automatically stores Express request and response objects:

```typescript
import { Injectable } from "@nestjs/common";
import { RequestContext, REQUEST, RESPONSE } from "@nest-boot/request-context";
import { Request, Response } from "express";

@Injectable()
export class HttpContextService {
  getRequest(): Request | undefined {
    return RequestContext.get<Request>(REQUEST);
  }

  getResponse(): Response | undefined {
    return RequestContext.get<Response>(RESPONSE);
  }

  getClientIp(): string | undefined {
    const req = this.getRequest();
    return req?.ip;
  }
}
```

## Creating Custom Contexts

### For Background Jobs

Use the `CreateRequestContext` decorator for methods that need their own context:

```typescript
import { Injectable } from "@nestjs/common";
import {
  CreateRequestContext,
  RequestContext,
} from "@nest-boot/request-context";

@Injectable()
export class JobProcessor {
  @CreateRequestContext(
    (instance, job) => new RequestContext({ type: "job", id: job.id }),
  )
  async processJob(job: { id: string; data: any }) {
    // This code runs within its own request context
    console.log(`Processing job ${RequestContext.id}`);
    RequestContext.set("jobData", job.data);
    await this.doWork();
  }

  private async doWork() {
    // Context is still available here
    const jobData = RequestContext.get("jobData");
  }
}
```

### Programmatic Context Creation

Create contexts manually using `RequestContext.run`:

```typescript
import { RequestContext } from "@nest-boot/request-context";

async function processInContext() {
  await RequestContext.run(
    new RequestContext({ type: "custom", id: "my-id" }),
    async (ctx) => {
      ctx.set("key", "value");
      // Do work within context
    },
  );
}
```

## Child Contexts

Create child contexts that inherit from the parent but have isolated modifications:

```typescript
import { RequestContext } from "@nest-boot/request-context";

async function example() {
  // In parent context
  RequestContext.set("userId", 123);

  await RequestContext.child(async (childCtx) => {
    // Can read parent values
    const userId = childCtx.get("userId"); // 123

    // Child modifications don't affect parent
    childCtx.set("tempData", "child only");
  });

  // Parent context unchanged
  RequestContext.get("tempData"); // undefined
}
```

## Registering Middlewares

Register custom middlewares that run when a context is created:

```typescript
import { RequestContext } from "@nest-boot/request-context";

// Register a middleware
RequestContext.registerMiddleware("auth", async (ctx, next) => {
  // Run before the main callback
  ctx.set("user", await loadUser());
  const result = await next();
  // Run after the main callback
  return result;
});

// Middleware with dependencies
RequestContext.registerMiddleware(
  "permissions",
  async (ctx, next) => {
    const user = ctx.get("user");
    ctx.set("permissions", await loadPermissions(user));
    return next();
  },
  ["auth"], // Runs after 'auth' middleware
);
```

## REPL Support

Start a REPL session with request context support:

```typescript
// repl.ts
import { repl } from "@nest-boot/request-context";
import { AppModule } from "./app.module";

async function bootstrap() {
  await repl(AppModule);
}

bootstrap();
```

Run with:

```bash
npx ts-node -r tsconfig-paths/register repl.ts
```

## Example: Request Logging

```typescript
import { Injectable, NestMiddleware } from "@nestjs/common";
import { RequestContext, REQUEST } from "@nest-boot/request-context";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      console.log({
        requestId: RequestContext.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  }
}
```

## Example: Multi-Tenant Context

```typescript
import { Injectable, NestMiddleware } from "@nestjs/common";
import { RequestContext } from "@nest-boot/request-context";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers["x-tenant-id"] as string;
    RequestContext.set("tenantId", tenantId);
    next();
  }
}

@Injectable()
export class TenantService {
  getCurrentTenant(): string | undefined {
    return RequestContext.get<string>("tenantId");
  }
}
```

## API Reference

See the complete [API documentation](/docs/api/@nest-boot/request-context) for detailed information.

## Features

- **AsyncLocalStorage Based** - Uses Node.js AsyncLocalStorage for reliable context propagation
- **Automatic HTTP Context** - Automatically creates context for HTTP requests
- **GraphQL Support** - Works with GraphQL resolvers via interceptor
- **Child Contexts** - Create isolated child contexts that inherit from parents
- **Middleware System** - Register middlewares with dependency ordering
- **REPL Support** - Interactive debugging with context support
