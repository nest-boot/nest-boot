import "dotenv/config";

import { BullModule } from "@nest-boot/bullmq";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { ScheduleModule } from ".";

describe("BullModule", () => {
  let app: INestApplication;

  it(`ScheduleModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BullModule, ScheduleModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`ScheduleModule.forRoot`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BullModule, ScheduleModule.forRoot({})],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`ScheduleModule.forRootAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule,
        ScheduleModule.forRootAsync({
          useFactory: () => ({}),
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
