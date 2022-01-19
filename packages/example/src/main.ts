import "source-map-support/register";

import { startHttpServer } from "@nest-boot/common";
import { NestFactory } from "@nestjs/core";

import { HttpModule } from "./app/http/http.module";

async function bootstrap() {
  const app = await NestFactory.create(HttpModule);
  await app.listen(3000);
}
bootstrap();
