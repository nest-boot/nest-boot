import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { CommonModule } from "./common.module";

describe("CommonModule", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CommonModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it(`should return an instance of CommonModule`, () => {
    expect(app.get(CommonModule)).toBeInstanceOf(CommonModule);
  });

  afterAll(async () => {
    await app.close();
  });
});
