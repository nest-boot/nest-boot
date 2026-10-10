import type { GraphQLRateLimitDriverInput } from "../../src/index.js";

let GraphQLRateLimitDriver: typeof import("../../src/index.js").GraphQLRateLimitDriver;
let MemoryGraphQLRateLimitDriver: typeof import("../../src/index.js").MemoryGraphQLRateLimitDriver;

describe("MemoryGraphQLRateLimitDriver", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
    vi.stubGlobal("performance", { now: () => Date.now() });

    ({ GraphQLRateLimitDriver, MemoryGraphQLRateLimitDriver } =
      await import("../../src/index.js"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("consumes points and leaves the bucket unchanged when blocked", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 6,
    };

    await expect(driver.update(input)).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 4,
    });
    await expect(driver.update({ ...input, points: 5 })).resolves.toEqual({
      blocked: true,
      currentlyAvailable: 4,
    });
  });

  it("restores points according to elapsed whole seconds", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 6,
    };

    await driver.update(input);
    vi.advanceTimersByTime(2000);

    await expect(driver.update({ ...input, points: 5 })).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 3,
    });
  });

  it("restores explicit negative points", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 6,
    };

    await driver.update(input);

    await expect(driver.update({ ...input, points: -3 })).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 7,
    });
  });

  it.each([
    { name: "elapsed restoration", elapsed: 2000, firstBalance: 100 },
    { name: "multiple in-flight refunds", elapsed: 1000, firstBalance: 95 },
    { name: "bucket expiration", elapsed: 4001, firstBalance: 100 },
  ])("caps refunds after $name", async ({ elapsed, firstBalance }) => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:refund",
      maximumAvailable: 100,
      restoreRate: 25,
    };

    try {
      await driver.update({ ...input, points: 30 });
      await driver.update({ ...input, points: 30 });
      vi.advanceTimersByTime(elapsed);

      const first = await driver.update({ ...input, points: -30 });
      expect(first.blocked).toBe(false);
      expect(first.currentlyAvailable).toBe(firstBalance);
      await expect(driver.update({ ...input, points: -30 })).resolves.toEqual({
        blocked: false,
        currentlyAvailable: 100,
      });
      await expect(driver.update({ ...input, points: 101 })).resolves.toEqual({
        blocked: true,
        currentlyAvailable: 100,
      });
    } finally {
      driver.close();
    }
  });

  it("serializes concurrent updates within the process", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 6,
    };

    await expect(
      Promise.all([driver.update(input), driver.update(input)]),
    ).resolves.toEqual([
      { blocked: false, currentlyAvailable: 4 },
      { blocked: true, currentlyAvailable: 4 },
    ]);
  });

  it("starts a fresh bucket after expiration", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 9,
    };

    await driver.update(input);
    vi.advanceTimersByTime(5001);

    await expect(driver.update({ ...input, points: 1 })).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 9,
    });
  });

  it("evicts idle buckets when another update observes their expiration", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const buckets = (
      driver as unknown as {
        buckets: { keys(): IterableIterator<string> };
      }
    ).buckets;

    await driver.update({
      key: "graphql-rate-limit:idle",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 1,
    });
    await driver.update({
      key: "graphql-rate-limit:long-lived",
      maximumAvailable: 60,
      restoreRate: 1,
      points: 1,
    });
    vi.advanceTimersByTime(5001);
    await driver.update({
      key: "graphql-rate-limit:active",
      maximumAvailable: 60,
      restoreRate: 1,
      points: 1,
    });

    expect([...buckets.keys()]).toEqual([
      "graphql-rate-limit:long-lived",
      "graphql-rate-limit:active",
    ]);
  });

  it("clears buckets when closed", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const input = {
      key: "graphql-rate-limit:client",
      maximumAvailable: 10,
      restoreRate: 2,
      points: 6,
    };

    await driver.update(input);
    driver.close();

    await expect(driver.update({ ...input, points: 1 })).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 9,
    });
  });

  it("provides an optional no-op close implementation for custom drivers", () => {
    class CustomDriver extends GraphQLRateLimitDriver {
      update(
        _input: GraphQLRateLimitDriverInput,
      ): Promise<{ blocked: boolean; currentlyAvailable: number }> {
        return Promise.resolve({ blocked: false, currentlyAvailable: 0 });
      }
    }

    expect(new CustomDriver().close()).toBeUndefined();
  });
});
