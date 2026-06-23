const { mockBaseProcessor, mockBaseProcessorDecorator, mockJobRef } =
  vi.hoisted(() => {
    const mockJobRef = Symbol("JOB_REF");
    const mockBaseProcessorDecorator = vi.fn();
    const mockBaseProcessor = vi.fn(() => mockBaseProcessorDecorator);

    return { mockBaseProcessor, mockBaseProcessorDecorator, mockJobRef };
  });

vi.mock("@nestjs/bullmq", () => ({
  JOB_REF: mockJobRef,
  Processor: mockBaseProcessor,
  WorkerHost: class WorkerHost {},
}));

import { RequestContext } from "@nest-boot/request-context";

import { Processor } from "./processor.decorator.js";

describe("Processor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should wrap process in a queue request context and apply the base decorator", async () => {
    const set = vi.spyOn(RequestContext.prototype, "set");
    const run = vi
      .spyOn(RequestContext, "run")
      .mockImplementation(async (ctx, callback) => await callback(ctx));
    const job = {
      id: "job-1",
    };
    class EmailProcessor {
      async process(input: typeof job) {
        await Promise.resolve();
        return `processed:${input.id}`;
      }
    }

    Processor("email")(EmailProcessor as never);

    await expect(new EmailProcessor().process(job)).resolves.toBe(
      "processed:job-1",
    );

    expect(set).toHaveBeenCalledWith(mockJobRef, job);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-1",
        type: "queue",
      }),
      expect.any(Function),
    );
    expect(mockBaseProcessor).toHaveBeenCalledWith("email", undefined);
    expect(mockBaseProcessorDecorator).toHaveBeenCalledWith(EmailProcessor);
  });

  it("should apply the base decorator when no process method exists", () => {
    class EmptyProcessor {}
    const processorOptions = {
      name: "email",
    };
    const workerOptions = {
      concurrency: 2,
    };

    Processor(processorOptions, workerOptions)(EmptyProcessor as never);

    expect(mockBaseProcessor).toHaveBeenCalledWith(
      processorOptions,
      workerOptions,
    );
    expect(mockBaseProcessorDecorator).toHaveBeenCalledWith(EmptyProcessor);
  });
});
