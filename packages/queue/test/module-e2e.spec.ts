import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Queue, QueueManager } from "../src";
import { AppModule } from "./src/app.module";
import {
  TEST_JOB_DATA,
  TEST_JOB_NAME,
  TEST_REQUEST_SCOPED_JOB_NAME,
} from "./src/constants";
import { delay } from "./src/delay";
import { TestConsumer } from "./src/test.consumer";
import { TestRequestScopedConsumer } from "./src/test-request-scoped.consumer";

describe("LoggerModule - e2e", () => {
  let app: INestApplication;
  let queueManager: QueueManager;
  let queue: Queue;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    queueManager = app.get(QueueManager);
    queue = app.get(Queue);
  });

  it(`消费者收到的数据应该要和发送者的一致`, async () => {
    await app.init();
    queueManager.run();

    await queue.add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testConsumer = app.get(TestConsumer);

    expect(testConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围消费者收到的数据应该要和发送者的一致`, async () => {
    await app.init();
    queueManager.run();

    await queue.add(TEST_REQUEST_SCOPED_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    expect(TestRequestScopedConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  afterEach(async () => {
    await app.close();
  });
});
