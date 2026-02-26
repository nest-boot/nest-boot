---
sidebar_position: 1
---

# Middleware

`@nest-boot/middleware` 模块为 NestJS 应用程序提供了一种灵活的方式来管理中间件，允许动态配置和依赖管理。

## 安装

```bash
npm install @nest-boot/middleware
# or
pnpm add @nest-boot/middleware
```

## 配置

在你的应用程序模块中注册 `MiddlewareModule`。

```typescript
import { Module } from "@nestjs/common";
import { MiddlewareModule } from "@nest-boot/middleware";

@Module({
  imports: [MiddlewareModule],
})
export class AppModule {}
```

## 使用

注入 `MiddlewareManager` 来动态注册中间件。

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
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly myMiddleware: MyMiddleware,
  ) {
    this.middlewareManager.apply(this.myMiddleware).forRoutes("*");
  }
}
```

### 依赖关系

你可以使用 `.dependencies()` 声明中间件之间的依赖关系。这确保依赖的中间件在从属中间件之前运行。

```typescript
this.middlewareManager
  .apply(this.authMiddleware)
  .dependencies(RequestContextMiddleware)
  .forRoutes("*");
```

### 全局排除

你可以从管理器管理的所有中间件中全局排除某些路由。

```typescript
this.middlewareManager.globalExclude("/health");
```
