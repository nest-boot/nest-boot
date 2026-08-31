import type Redis from "ioredis";

import { RedisGraphQLRateLimitDriver } from "../../src/drivers/redis-graphql-rate-limit.driver.js";

describe("RedisGraphQLRateLimitDriver", () => {
  it("registers and calls an atomic one-key Redis command", async () => {
    const command = vi.fn().mockResolvedValue([null, "40"]);
    const defineCommand = vi.fn();
    const redis = {
      defineCommand,
      GRAPHQL_RATE_LIMIT: command,
      quit: vi.fn(),
    } as unknown as Redis;
    const driver = new RedisGraphQLRateLimitDriver(redis);

    expect(defineCommand).toHaveBeenCalledWith(
      "GRAPHQL_RATE_LIMIT",
      expect.objectContaining({ numberOfKeys: 1 }),
    );
    await expect(
      driver.update({
        key: "graphql-rate-limit:client",
        maximumAvailable: 100,
        restoreRate: 5,
        points: 60,
      }),
    ).resolves.toEqual({ blocked: false, currentlyAvailable: 40 });
    expect(command).toHaveBeenCalledWith(
      "graphql-rate-limit:client",
      100,
      5,
      60,
    );
  });

  it("normalizes the Redis blocked response", async () => {
    const redis = {
      defineCommand: vi.fn(),
      GRAPHQL_RATE_LIMIT: vi.fn().mockResolvedValue([1, 4]),
      quit: vi.fn(),
    } as unknown as Redis;
    const driver = new RedisGraphQLRateLimitDriver(redis);

    await expect(
      driver.update({
        key: "graphql-rate-limit:client",
        maximumAvailable: 10,
        restoreRate: 2,
        points: 5,
      }),
    ).resolves.toEqual({ blocked: true, currentlyAvailable: 4 });
  });

  it("closes its Redis client", async () => {
    const quit = vi.fn().mockResolvedValue("OK");
    const redis = {
      defineCommand: vi.fn(),
      GRAPHQL_RATE_LIMIT: vi.fn(),
      quit,
    } as unknown as Redis;
    const driver = new RedisGraphQLRateLimitDriver(redis);

    await driver.close();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});
