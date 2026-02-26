---
sidebar_position: 3
---

# Request Context

`@nest-boot/request-context` 模块提供了一种使用 Node.js `AsyncLocalStorage` 存储和检索作用于当前执行上下文（例如 HTTP 请求、队列作业）的数据的方法。

## 安装

```bash
npm install @nest-boot/request-context
# or
pnpm add @nest-boot/request-context
```

## 配置

在你的应用程序模块中注册 `RequestContextModule`。

```typescript
import { Module } from "@nestjs/common";
import { RequestContextModule } from "@nest-boot/request-context";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```

## 使用

### 存储和检索数据

```typescript
import { RequestContext } from "@nest-boot/request-context";

// 设置数据
RequestContext.set("key", "value");

// 获取数据
const value = RequestContext.get<string>("key");
```

### 访问 Request/Response

对于 HTTP 请求，Express 的 `Request` 和 `Response` 对象会自动附加到上下文中。

```typescript
import { RequestContext, REQUEST } from "@nest-boot/request-context";
import { Request } from "express";

const req = RequestContext.get<Request>(REQUEST);
```

### 创建上下文

你可以为后台任务或其他异步操作手动创建上下文。

```typescript
import { RequestContext } from "@nest-boot/request-context";

await RequestContext.run(
  new RequestContext({ type: "background" }),
  async () => {
    // 你的代码
  },
);
```

或者使用 `@CreateRequestContext` 装饰器。

```typescript
import { CreateRequestContext } from "@nest-boot/request-context";

class MyService {
  @CreateRequestContext()
  async backgroundTask() {
    // 上下文在这里可用
  }
}
```
