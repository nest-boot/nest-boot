---
sidebar_position: 2
---

# 日志 Logger

Nest Boot 使用 pino 作为底层记录器，所以仅支持 JSON 格式日志。

## 安装依赖

```shell
npm i @nest-boot/logger
```

## 注册模块

```typescript
// ./app.module.ts
import { LoggerModule } from "@nest-boot/logger";

@Module({
  imports: [LoggerModule.register({})],
})
export class AppModule {}
```

需要修改启动入口：

```typescript
// ./main.ts
import { Logger } from "@nest-boot/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    /* 设置 bufferLogs 为 true 以确保所有日志都将被缓冲。
     * 直到自定义记录器（@nest-boot/logger）初始化完成后开始输出日志。
     * 如果初始化过程失败，Nest 将回退到默认日志记录器以打印出所有报告的错误消息。
     */
    bufferLogs: true,
  });

  // 获取日志服务实例
  const logger = await app.resolve(Logger);

  // 在 Node.js v18.0.0 之后，不监听 Promise 未解决拒绝会导致程序崩溃。
  process.on("unhandledRejection", (err, promise) => {
    logger.error("Unhandled rejection exception", { err, promise });
  });

  // 使用日志服务实例
  app.useLogger(logger);

  await app.listen(3000);
}

bootstrap();
```

### 打印美化

JSON 格式的日志方便机器阅读但不适合人类阅读，建议开发时配合 [pino-pretty](https://github.com/pinojs/pino-pretty) 工具进行日志美化。
