import "dotenv/config";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { GraphQLModule } from "../src";
import { TestResolver } from "./test.resolver";

describe("GraphQLModule", () => {
  let app: INestApplication;

  it(`GraphQLModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLModule],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`GraphQLModule.forRoot`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLModule.forRoot({})],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`GraphQLModule.forRootAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRootAsync({
          useFactory: () => ({}),
        }),
      ],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
