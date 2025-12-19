---
sidebar_position: 5
---

# Request Context 模块

`@nest-boot/request-context` 模块使用 Node.js AsyncLocalStorage 提供请求作用域存储。它允许你在整个请求生命周期中存储和访问数据，而无需通过每个函数调用传递。

## 安装

```bash
npm install @nest-boot/request-context @nest-boot/middleware
# 或
pnpm add @nest-boot/request-context @nest-boot/middleware
```

## 基本用法

### 模块注册

在应用模块中注册 `RequestContextModule`：

```typescript
import { Module } from "@nestjs/common";
import { RequestContextModule } from "@nest-boot/request-context";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```

该模块是全局的，只需导入一次。

### 存储和获取数据

使用静态方法与当前请求上下文交互：

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

### 访问请求 ID

每个上下文都有一个唯一的 ID，可用于日志记录和追踪：

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

## 访问 HTTP 请求/响应

模块自动存储 Express 的 request 和 response 对象：

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

## 创建自定义上下文

### 用于后台任务

使用 `CreateRequestContext` 装饰器为需要独立上下文的方法创建上下文：

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
    // 此代码在自己的请求上下文中运行
    console.log(`Processing job ${RequestContext.id}`);
    RequestContext.set("jobData", job.data);
    await this.doWork();
  }

  private async doWork() {
    // 上下文在这里仍然可用
    const jobData = RequestContext.get("jobData");
  }
}
```

### 编程式创建上下文

使用 `RequestContext.run` 手动创建上下文：

```typescript
import { RequestContext } from "@nest-boot/request-context";

async function processInContext() {
  await RequestContext.run(
    new RequestContext({ type: "custom", id: "my-id" }),
    async (ctx) => {
      ctx.set("key", "value");
      // 在上下文中执行工作
    },
  );
}
```

## 子上下文

创建继承自父上下文但具有隔离修改的子上下文：

```typescript
import { RequestContext } from "@nest-boot/request-context";

async function example() {
  // 在父上下文中
  RequestContext.set("userId", 123);

  await RequestContext.child(async (childCtx) => {
    // 可以读取父上下文的值
    const userId = childCtx.get("userId"); // 123

    // 子上下文的修改不影响父上下文
    childCtx.set("tempData", "child only");
  });

  // 父上下文保持不变
  RequestContext.get("tempData"); // undefined
}
```

## 注册中间件

注册在创建上下文时运行的自定义中间件：

```typescript
import { RequestContext } from "@nest-boot/request-context";

// 注册中间件
RequestContext.registerMiddleware("auth", async (ctx, next) => {
  // 在主回调之前运行
  ctx.set("user", await loadUser());
  const result = await next();
  // 在主回调之后运行
  return result;
});

// 带依赖的中间件
RequestContext.registerMiddleware(
  "permissions",
  async (ctx, next) => {
    const user = ctx.get("user");
    ctx.set("permissions", await loadPermissions(user));
    return next();
  },
  ["auth"], // 在 'auth' 中间件之后运行
);
```

## REPL 支持

启动带有请求上下文支持的 REPL 会话：

```typescript
// repl.ts
import { repl } from "@nest-boot/request-context";
import { AppModule } from "./app.module";

async function bootstrap() {
  await repl(AppModule);
}

bootstrap();
```

运行：

```bash
npx ts-node -r tsconfig-paths/register repl.ts
```

## 示例：请求日志

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

## 示例：多租户上下文

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

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/request-context) 获取详细信息。

## 特性

- **基于 AsyncLocalStorage** - 使用 Node.js AsyncLocalStorage 实现可靠的上下文传播
- **自动 HTTP 上下文** - 自动为 HTTP 请求创建上下文
- **GraphQL 支持** - 通过拦截器支持 GraphQL 解析器
- **子上下文** - 创建继承自父上下文的隔离子上下文
- **中间件系统** - 注册带依赖排序的中间件
- **REPL 支持** - 带上下文支持的交互式调试
