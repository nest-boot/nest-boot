import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { CUSTOM_CONTENT_NAME } from "../src/constants";
import { TestService } from "../src/test.service";

describe("LoggerModule - e2e", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
  });

  it(`默认上下文名称应该为类名`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.defaultContextName).toEqual(TestService.name);
  });

  it(`设置上下文后读取上下文应该和设定值一致`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.customContextName).toEqual(CUSTOM_CONTENT_NAME);
  });

  afterEach(async () => {
    await app.close();
  });
});
