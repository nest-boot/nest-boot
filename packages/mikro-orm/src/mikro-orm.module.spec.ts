import "dotenv/config";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { TestEntity } from "../test/test.entity";
import { MikroOrmModule } from ".";

describe("MikroOrmModule", () => {
  let app: INestApplication;

  it(`MikroOrmModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MikroOrmModule, MikroOrmModule.forFeature([TestEntity])],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`MikroOrmModule.forRoot`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({}),
        MikroOrmModule.forFeature([TestEntity]),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`BullModule.forRootAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRootAsync({
          useFactory: () => ({}),
        }),
        MikroOrmModule.forFeature([TestEntity]),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
