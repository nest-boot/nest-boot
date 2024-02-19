import { INestApplication } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { getQueueToken, Queue, QueueModule } from ".";

describe("QueueModule", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        QueueModule.register({
          name: "register",
          connection: {
            host: process.env.REDIS_HOST,
            port: +(process.env.REDIS_PORT ?? 6379),
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
          },
        }),
        QueueModule.registerAsync({
          name: "registerAsync",
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
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it(`应该返回注册队列`, () => {
    expect(app.get(getQueueToken("register"))).toBeInstanceOf(Queue);
  });

  it(`应该返回异步注册队列`, () => {
    expect(app.get(getQueueToken("registerAsync"))).toBeInstanceOf(Queue);
  });

  afterAll(async () => {
    await app.close();
  });
});
