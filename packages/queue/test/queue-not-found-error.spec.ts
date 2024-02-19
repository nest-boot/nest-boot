import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { QueueModule } from "../src";
import { QueueNotFoundConsumer } from "./src/queue-not-found.consumer";
import { QueueNotFoundProcessor } from "./src/queue-not-found.processor";

describe("Queue not found Error", () => {
  it(`消费者找不到队列实例时，应该抛出异常`, async () => {
    const module = await Test.createTestingModule({
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
      providers: [QueueNotFoundConsumer],
    }).compile();

    await expect(module.init()).rejects.toThrow(
      "Queue QUEUE_NOT_FOUND_QUEUE_NAME not found for consumer QueueNotFoundConsumer",
    );
  });

  it(`处理器找不到队列实例时，应该抛出异常`, async () => {
    const module = await Test.createTestingModule({
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
      providers: [QueueNotFoundProcessor],
    }).compile();

    await expect(module.init()).rejects.toThrow(
      "Queue QUEUE_NOT_FOUND_QUEUE_NAME not found for processor QueueNotFoundProcessor",
    );
  });
});
