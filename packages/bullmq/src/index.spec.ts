import { BullModule } from "./bullmq.module.js";
import * as publicApi from "./index.js";
import { OnQueueEvent } from "./on-queue-event.decorator.js";
import { OnWorkerEvent } from "./on-worker-event.decorator.js";
import { Processor } from "./processor.decorator.js";

describe("public API", () => {
  it("should export Bull module and upstream BullMQ helpers", () => {
    expect(publicApi.BullModule).toBe(BullModule);
    expect(publicApi.Processor).toBe(Processor);
    expect(publicApi.OnQueueEvent).toBe(OnQueueEvent);
    expect(publicApi.OnWorkerEvent).toBe(OnWorkerEvent);
    expect(publicApi.WorkerHost).toBeDefined();
    expect(publicApi.QueueEventsListener).toBeDefined();
  });
});
