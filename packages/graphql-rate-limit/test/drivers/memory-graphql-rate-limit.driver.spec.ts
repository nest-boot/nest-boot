import { MemoryGraphQLRateLimitDriver } from "../../src/drivers/memory-graphql-rate-limit.driver";

describe("MemoryGraphQLRateLimitDriver", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
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
    jest.advanceTimersByTime(2000);

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
    jest.advanceTimersByTime(5000);

    await expect(driver.update({ ...input, points: 1 })).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 9,
    });
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
});
