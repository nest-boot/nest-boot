import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";

import { Queue, QueueManager } from "../src";
import { AppModule } from "./src/app.module";
import {
  TEST_BULK_JOB_NAME,
  TEST_JOB_DATA,
  TEST_JOB_NAME,
  TEST_REQUEST_SCOPED_JOB_NAME,
} from "./src/constants";
import { DefaultConsumer } from "./src/default.consumer";
import { delay } from "./src/delay";
import { PublishService } from "./src/publish.service";
import { TestConsumer } from "./src/test.consumer";
import { TestProcessor } from "./src/test.processor";
import { TestBulkProcessor } from "./src/test-bulk.processor";
import { TestRequestScopedConsumer } from "./src/test-request-scoped.consumer";
import { TestRequestScopedProcessor } from "./src/test-request-scoped.processor";

describe("QueueModule - e2e", () => {
  let app: INestApplication;
  let queueManager: QueueManager;
  let publishService: PublishService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    await app.init();

    queueManager = app.get(QueueManager);
    publishService = app.get(PublishService);

    queueManager.runAll();
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  it(`队列管理器应该能获取到已注册队列实例`, async () => {
    const defaultQueue = queueManager.get("default");

    expect(defaultQueue).toBeInstanceOf(Queue);
  });

  it(`批量添加任务后收到的数据应该要和发送数据一致`, async () => {
    const testDataGroup = Array.from({ length: 3 }, () => ({
      name: TEST_BULK_JOB_NAME,
      data: TEST_JOB_DATA,
    }));

    await publishService.defaultQueue.addBulk(testDataGroup);

    await delay(1000);

    const testBulkProcessor = app.get(TestBulkProcessor);

    expect(testBulkProcessor.jobs[0].data).toEqual(testDataGroup[0].data);
    expect(testBulkProcessor.jobs[1].data).toEqual(testDataGroup[1].data);
    expect(testBulkProcessor.jobs[2].data).toEqual(testDataGroup[2].data);
  });

  it(`默认消费者收到的数据应该要和发送者的一致`, async () => {
    await publishService.defaultQueue.add(randomUUID(), TEST_JOB_DATA);

    await delay(1000);

    const defaultConsumer = app.get(DefaultConsumer);

    expect(defaultConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`消费者收到的数据应该要和发送者的一致`, async () => {
    await publishService.testQueue.add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testConsumer = app.get(TestConsumer);

    expect(testConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围消费者收到的数据应该要和发送者的一致`, async () => {
    await publishService.testRequestScopedQueue.add(
      TEST_REQUEST_SCOPED_JOB_NAME,
      TEST_JOB_DATA,
    );

    await delay(1000);

    expect(TestRequestScopedConsumer.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`处理器收到的数据应该要和发送者的一致`, async () => {
    await publishService.defaultQueue.add(TEST_JOB_NAME, TEST_JOB_DATA);

    await delay(1000);

    const testProcessor = app.get(TestProcessor);

    expect(testProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  it(`请求范围处理器收到的数据应该要和发送者的一致`, async () => {
    await publishService.defaultQueue.add(
      TEST_REQUEST_SCOPED_JOB_NAME,
      TEST_JOB_DATA,
    );

    await delay(1000);

    expect(TestRequestScopedProcessor.job?.data).toEqual(TEST_JOB_DATA);
  });

  afterEach(async () => {
    await app.close();
  });
});
