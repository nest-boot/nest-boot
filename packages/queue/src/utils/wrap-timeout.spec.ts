import { Job } from "../interfaces";
import { wrapTimeout } from "./wrap-timeout";

describe("wrapTimeout", () => {
  it("should execute the processor function and clear the timeout", async () => {
    const processor = jest.fn();
    const job = { opts: {} } as Job;

    jest.spyOn(global, "clearTimeout");

    await wrapTimeout(processor)(job);

    expect(processor).toHaveBeenCalledWith(job);
    expect(clearTimeout).toHaveBeenCalled();
  });

  it("should reject with an error if job processing exceeds the timeout", async () => {
    const processor = jest.fn();
    const job = { opts: { timeout: 1000 } } as Job;

    jest.useFakeTimers();

    const promise = wrapTimeout(processor)(job);

    jest.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow("Job processing timeout");

    jest.useRealTimers();
  });
});
