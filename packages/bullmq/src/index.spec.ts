import * as publicApi from ".";
import { BullModule } from "./bullmq.module";
import { Processor } from "./processor.decorator";

describe("public API", () => {
  it("should export Bull module and upstream BullMQ helpers", () => {
    expect(publicApi.BullModule).toBe(BullModule);
    expect(publicApi.Processor).toBe(Processor);
    expect(publicApi.WorkerHost).toBeDefined();
    expect(publicApi.QueueEventsListener).toBeDefined();
  });
});
