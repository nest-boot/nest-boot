import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { QueueModule } from "../../src";
import { TestConsumer } from "./test.consumer";
import { TestRequestScopedConsumer } from "./test-request-scoped.consumer";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          username: configService.get("REDIS_USERNAME"),
          password: configService.get("REDIS_PASSWORD"),
        },
      }),
    }),
  ],
  providers: [TestConsumer, TestRequestScopedConsumer],
})
export class AppModule {}
