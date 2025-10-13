import "dotenv/config";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { BullModule } from ".";

describe("BullModule", () => {
  let app: INestApplication;

  it(`BullModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BullModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`BullModule.forRoot`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BullModule.forRoot({})],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`BullModule.forRootAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRootAsync({
          useFactory: () => ({}),
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
