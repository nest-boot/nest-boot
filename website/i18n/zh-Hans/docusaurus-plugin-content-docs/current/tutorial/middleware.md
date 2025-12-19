---
sidebar_position: 3
---

# Middleware 模块

`@nest-boot/middleware` 模块提供了一种集中且灵活的方式来管理 NestJS 应用中的中间件注册。它支持依赖排序、路由排除和全局配置。

## 安装

```bash
npm install @nest-boot/middleware
# 或
pnpm add @nest-boot/middleware
```

## 基本用法

### 模块注册

在应用模块中导入 `MiddlewareModule`：

```typescript
import { Module } from "@nestjs/common";
import { MiddlewareModule } from "@nest-boot/middleware";

@Module({
  imports: [MiddlewareModule],
})
export class AppModule {}
```

### 使用 MiddlewareManager

注入 `MiddlewareManager` 并使用流式 API 注册中间件：

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

## 流式 API

### 应用中间件

```typescript
middlewareManager
  .apply(middleware1, middleware2)
  .forRoutes("users", "products");
```

### 排除路由

```typescript
middlewareManager
  .apply(authMiddleware)
  .exclude("health", { path: "auth/login", method: RequestMethod.POST })
  .forRoutes("*");
```

### 全局路由排除

设置应从所有中间件中排除的路由：

```typescript
middlewareManager.globalExclude("health", "metrics");

// 之后注册的所有中间件都会排除这些路由
middlewareManager.apply(middleware1).forRoutes("*");
```

### 为特定中间件禁用全局排除

```typescript
middlewareManager
  .apply(metricsMiddleware)
  .disableGlobalExcludeRoutes()
  .forRoutes("*");
```

### 中间件依赖

确保中间件按特定顺序执行：

```typescript
@Injectable()
class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // 认证逻辑
    next();
  }
}

@Injectable()
class RateLimitMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // 限流逻辑（需要认证信息）
    next();
  }
}

// RateLimitMiddleware 将始终在 AuthMiddleware 之后运行
middlewareManager
  .apply(rateLimitMiddleware)
  .dependencies(AuthMiddleware)
  .forRoutes("*");

middlewareManager.apply(authMiddleware).forRoutes("*");
```

## 完整示例

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
    // 检查认证
    const token = req.headers.authorization;
    if (token) {
      req.user = { id: "123" }; // 简化示例
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
    // 全局排除
    this.middlewareManager.globalExclude("health", "metrics");

    // Logger 在所有路由上运行
    this.middlewareManager.apply(this.loggerMiddleware).forRoutes("*");

    // Auth 在受保护路由上运行，在 logger 之后
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

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/middleware) 获取详细信息。

## 特性

- **集中管理** - 在一个地方注册所有中间件
- **依赖排序** - 根据依赖关系自动排序中间件
- **循环依赖检测** - 检测到循环依赖时抛出错误
- **全局排除** - 定义从所有中间件排除的路由
- **单独排除** - 对路由排除进行细粒度控制
- **流式 API** - 简洁、可链式调用的配置语法
