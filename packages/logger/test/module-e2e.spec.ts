import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "./src/app.module";
import { CUSTOM_CONTENT_NAME } from "./src/constants";
import { TestService } from "./src/test.service";

describe("LoggerModule - e2e", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
  });

  it(`default context name should be the class name`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.defaultContextName).toEqual(TestService.name);
  });

  it(`reading context after setting it should match the set value`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.customContextName).toEqual(CUSTOM_CONTENT_NAME);
  });

  afterEach(async () => {
    await app.close();
  });
});
