import * as publicApi from "./index.js";
import { OnQueueEvent } from "./on-queue-event.decorator.js";
import { OnWorkerEvent } from "./on-worker-event.decorator.js";
import { Processor } from "./processor.decorator.js";
import { QueueModule } from "./queue.module.js";

describe("public API", () => {
  it("should export queue module and upstream BullMQ helpers", () => {
    expect(publicApi.QueueModule).toBe(QueueModule);
    expect(publicApi).not.toHaveProperty("BullModule");
    expect(publicApi.Processor).toBe(Processor);
    expect(publicApi.OnQueueEvent).toBe(OnQueueEvent);
    expect(publicApi.OnWorkerEvent).toBe(OnWorkerEvent);
    expect(publicApi.WorkerHost).toBeDefined();
    expect(publicApi.QueueEventsListener).toBeDefined();
  });
});
