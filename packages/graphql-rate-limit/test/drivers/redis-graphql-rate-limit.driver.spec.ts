import type Redis from "ioredis";

import { RedisGraphQLRateLimitDriver } from "../../src/drivers/redis-graphql-rate-limit.driver";

describe("RedisGraphQLRateLimitDriver", () => {
  it("registers and calls an atomic one-key Redis command", async () => {
    const command = jest.fn().mockResolvedValue([null, "40"]);
    const defineCommand = jest.fn();
    const redis = {
      defineCommand,
      GRAPHQL_RATE_LIMIT: command,
      quit: jest.fn(),
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
      defineCommand: jest.fn(),
      GRAPHQL_RATE_LIMIT: jest.fn().mockResolvedValue([1, 4]),
      quit: jest.fn(),
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
    const quit = jest.fn().mockResolvedValue("OK");
    const redis = {
      defineCommand: jest.fn(),
      GRAPHQL_RATE_LIMIT: jest.fn(),
      quit,
    } as unknown as Redis;
    const driver = new RedisGraphQLRateLimitDriver(redis);

    await driver.close();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});
