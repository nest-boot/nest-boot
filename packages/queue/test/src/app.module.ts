import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { QueueModule } from "../../src";
import { TEST_QUEUE_NAME, TEST_REQUEST_SCOPED_QUEUE_NAME } from "./constants";
import { TestConsumer } from "./test.consumer";
import { TestLegacyProcessor } from "./test.legacy-processor";
import { TestProcessor } from "./test.processor";
import { TestRequestScopedConsumer } from "./test-request-scoped.consumer";
import { TestRequestScopedLegacyProcessor } from "./test-request-scoped.legacy-processor";
import { TestRequestScopedProcessor } from "./test-request-scoped.processor";

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
    QueueModule.registerAsync({
      name: TEST_QUEUE_NAME,
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
    QueueModule.registerAsync({
      name: TEST_REQUEST_SCOPED_QUEUE_NAME,
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
  providers: [
    TestConsumer,
    TestProcessor,
    TestLegacyProcessor,
    TestRequestScopedConsumer,
    TestRequestScopedProcessor,
    TestRequestScopedLegacyProcessor,
  ],
})
export class AppModule {}
