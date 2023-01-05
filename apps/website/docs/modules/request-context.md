---
sidebar_position: 1
---

# 请求上下文

请求上下文是一个全局对象，可以在任何地方访问，它包含了当前请求的信息，比如请求的 URL、请求的方法、请求的参数、请求的头部信息等。

不仅限于 HTTP 服务，其他模块如队列、定时任务等也有请求上下文，但包含的请求信息不一样。

## 安装

```shell
npm i @nest-boot/request-context
```

## 使用

```typescript
// ./app.module.ts
import { RequestContextModule } from "@nest-boot/request-context";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```
