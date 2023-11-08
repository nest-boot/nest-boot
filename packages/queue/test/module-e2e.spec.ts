import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { getQueueToken, Queue, QueueManager } from "../src";
import { AppModule } from "./src/app.module";
import {
  TEST_JOB_DATA,
  TEST_JOB_NAME,
  TEST_QUEUE_NAME,
  TEST_REQUEST_SCOPED_JOB_NAME,
  TEST_REQUEST_SCOPED_QUEUE_NAME,
} from "./src/constants";
import { delay } from "./src/delay";
import { TestConsumer } from "./src/test.consumer";
import { TestLegacyProcessor } from "./src/test.legacy-processor";
import { TestProcessor } from "./src/test.processor";
import { TestRequestScopedConsumer } from "./src/test-request-scoped.consumer";
import { TestRequestScopedLegacyProcessor } from "./src/test-request-scoped.legacy-processor";
import { TestRequestScopedProcessor } from "./src/test-request-scoped.processor";

describe("LoggerModule - e2e", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    await app.init();

    app.get(QueueManager).runAll();
  });

  it(`消费者收到的数据应该要和发送者的一致`, async () => {
    await app
      .get(getQueueToken(TEST_QUEUE_NAME))
      .add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testConsumer = app.get(TestConsumer);

    expect(testConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围消费者收到的数据应该要和发送者的一致`, async () => {
    await app
      .get(getQueueToken(TEST_REQUEST_SCOPED_QUEUE_NAME))
      .add(TEST_REQUEST_SCOPED_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    expect(TestRequestScopedConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`处理器收到的数据应该要和发送者的一致`, async () => {
    await app.get(Queue).add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testProcessor = app.get(TestProcessor);

    expect(testProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围处理器收到的数据应该要和发送者的一致`, async () => {
    await app.get(Queue).add(TEST_REQUEST_SCOPED_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    expect(TestRequestScopedProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`经典处理器收到的数据应该要和发送者的一致`, async () => {
    await app.get(Queue).add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testLegacyProcessor = app.get(TestLegacyProcessor);

    expect(testLegacyProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围经典处理器收到的数据应该要和发送者的一致`, async () => {
    await app.get(Queue).add(TEST_REQUEST_SCOPED_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    expect(TestRequestScopedLegacyProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  afterEach(async () => {
    await app.close();
  });
});
