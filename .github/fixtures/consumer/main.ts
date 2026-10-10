import "reflect-metadata";
import "./imports.js";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { HashModule, HashService } from "@nest-boot/hash";
import { HealthCheckModule } from "@nest-boot/health-check";
import { Mailer, MailerModule } from "@nest-boot/mailer";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Controller()
class ConsumerController {
  constructor(private readonly hash: HashService) {}

  @Get("probe")
  async probe() {
    const hash = await this.hash.hash("consumer-password");
    return {
      context: RequestContext.isActive(),
      verified: await this.hash.verify(hash, "consumer-password"),
    };
  }
}

@Module({
  imports: [
    RequestContextModule,
    HealthCheckModule,
    HashModule.register({ secret: randomBytes(32).toString("base64url") }),
    MailerModule.register({ jsonTransport: true }),
  ],
  controllers: [ConsumerController],
})
class ConsumerModule {}

const app = await NestFactory.create(ConsumerModule, {
  logger: false,
  abortOnError: false,
});
try {
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const response = await fetch(`${base}/probe`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { context: true, verified: true });
  const health = await fetch(`${base}/api/health`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const mail = await app.get(Mailer).sendMail({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Packed consumer",
    text: "Hello",
  });
  assert.equal(JSON.parse(mail.message).subject, "Packed consumer");
  console.log(
    "Public imports, TypeScript declarations, DI, HTTP, health, Argon2, and mail passed",
  );
} finally {
  await app.close();
}
