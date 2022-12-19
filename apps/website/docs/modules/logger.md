---
sidebar_position: 1
---

# 日志

Nest Boot 使用 pino 作为底层记录器，会自动关联 HTTP 请求上下文。

## 安装

```shell
npm i @nest-boot/logger
```

## 使用

```typescript
// ./app.module.ts
import { LoggerModule } from "@nest-boot/logger";

@Module({
  imports: [
    LoggerModule.register({
      prettyPrint: true,
    }),
  ],
})
export class AppModule {}
```

```typescript
// ./main.ts
import { Logger } from "@nest-boot/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const logger = new Logger();

process.on("unhandledRejection", (err, promise) => {
  logger.error("Unhandled rejection exception", { err, promise });
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(logger);

  await app.listen(3000);
}

bootstrap();
```
