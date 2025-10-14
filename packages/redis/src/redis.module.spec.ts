import "dotenv/config";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { RedisModule } from ".";

describe("RedisModule", () => {
  let app: INestApplication;

  it(`RedisModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`RedisModule.register`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule.register({})],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`RedisModule.registerAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        RedisModule.registerAsync({
          useFactory: () => ({}),
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
