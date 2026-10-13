import { Writable } from "node:stream";

import type { QueueRegistrar } from "../queue.registrar.js";
import { QueueRunCommand } from "./queue-run.command.js";

const stdout = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
afterEach(() => vi.restoreAllMocks());

it.each(["SIGINT", "SIGTERM"])(
  "waits for %s and removes signal handlers before application teardown",
  async (signal) => {
    const handlers = new Map<string | symbol, (...args: any[]) => void>();
    const on = vi.spyOn(process, "on").mockImplementation((event, handler) => {
      handlers.set(event, handler);
      return process;
    });
    const off = vi.spyOn(process, "off").mockImplementation(() => process);
    const start = vi.fn().mockResolvedValue(["reports", "emails"]);
    const command = new QueueRunCommand({
      start,
      waitForStop: () => new Promise<void>(() => undefined),
    } as unknown as QueueRegistrar);
    command.queues = ["reports", "emails"];
    command.context = { stdout } as never;
    let finished = false;
    const running = command.execute().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(start).toHaveBeenCalledWith(["reports", "emails"]);
    expect(finished).toBe(false);
    const handler = handlers.get(signal);
    expect(handler).toBeDefined();
    handler?.(signal);
    await running;
    expect(on).toHaveBeenCalledTimes(2);
    expect(off).toHaveBeenCalledWith("SIGINT", handlers.get("SIGINT"));
    expect(off).toHaveBeenCalledWith("SIGTERM", handlers.get("SIGTERM"));
  },
);

it("cleans signal handlers when startup fails", async () => {
  const on = vi.spyOn(process, "on");
  const off = vi.spyOn(process, "off");
  const start = vi.fn().mockRejectedValue(new Error("invalid queue"));
  const command = new QueueRunCommand({ start } as unknown as QueueRegistrar);
  command.context = { stdout } as never;
  await expect(command.execute()).rejects.toThrow("invalid queue");
  for (const [event, handler] of on.mock.calls)
    expect(off).toHaveBeenCalledWith(event, handler);
});

it("returns when interrupted while startup is pending", async () => {
  const handlers = new Map<string | symbol, () => void>();
  vi.spyOn(process, "on").mockImplementation((event, handler) => {
    handlers.set(event, handler);
    return process;
  });
  const off = vi.spyOn(process, "off");
  const command = new QueueRunCommand({
    start: () => new Promise<string[]>(() => undefined),
  } as unknown as QueueRegistrar);
  command.context = { stdout } as never;
  const running = command.execute();
  handlers.get("SIGTERM")?.();
  await running;
  expect(off).toHaveBeenCalledWith("SIGTERM", handlers.get("SIGTERM"));
});

it("propagates a fatal consumer failure and removes signal handlers", async () => {
  const failure = new Error("worker transport stopped");
  const off = vi.spyOn(process, "off");
  const command = new QueueRunCommand({
    start: () => Promise.resolve(["reports"]),
    waitForStop: () => Promise.reject(failure),
  } as unknown as QueueRegistrar);
  command.context = { stdout } as never;
  await expect(command.execute()).rejects.toBe(failure);
  expect(off).toHaveBeenCalledTimes(2);
});
