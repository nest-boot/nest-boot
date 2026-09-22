import Redis from "ioredis";

import { RedisGraphQLRateLimitDriver } from "../../src/drivers/redis-graphql-rate-limit.driver.js";

const redisUrl = process.env.REDIS_URL;
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis("RedisGraphQLRateLimitDriver integration", () => {
  const key = `graphql-rate-limit:test:${String(process.pid)}`;
  let redis: Redis;
  let driver: RedisGraphQLRateLimitDriver;

  beforeAll(() => {
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for Redis integration tests");
    }

    redis = new Redis(redisUrl);
    driver = new RedisGraphQLRateLimitDriver(redis);
  });

  beforeEach(async () => {
    await redis.del(key);
  });

  afterAll(async () => {
    await redis.del(key);
    await driver.close();
  });

  it.each([
    { name: "elapsed restoration", elapsed: 2, expired: false },
    { name: "multiple in-flight refunds", elapsed: 1, expired: false },
    { name: "bucket expiration", elapsed: 0, expired: true },
  ])("caps refunds after $name", async ({ elapsed, expired }) => {
    const input = { key, maximumAvailable: 100, restoreRate: 25 };
    await driver.update({ ...input, points: 30 });
    await driver.update({ ...input, points: 30 });
    if (expired) {
      // Simulate Redis expiring this test bucket before the response refund.
      await redis.del(key);
    } else {
      const [timestamp] = await redis.time();
      await redis.hset(key, "updatedTimestamp", Number(timestamp) - elapsed);
    }

    const refunds = await Promise.all([
      driver.update({ ...input, points: -30 }),
      driver.update({ ...input, points: -30 }),
    ]);
    for (const refund of refunds) {
      expect(refund.blocked).toBe(false);
      expect(refund.currentlyAvailable).toBeLessThanOrEqual(100);
    }
    expect(refunds[1].currentlyAvailable).toBe(100);
    await expect(driver.update({ ...input, points: 101 })).resolves.toEqual({
      blocked: true,
      currentlyAvailable: 100,
    });
  });

  it("consumes, blocks, and restores points atomically", async () => {
    const input = {
      key,
      maximumAvailable: 1_000_000,
      restoreRate: 1,
      points: 600_000,
    };

    const consumed = await driver.update(input);
    expect(consumed.blocked).toBe(false);
    expect(consumed.currentlyAvailable).toBeGreaterThanOrEqual(400_000);
    expect(consumed.currentlyAvailable).toBeLessThan(400_010);

    const blocked = await driver.update({ ...input, points: 500_000 });
    expect(blocked.blocked).toBe(true);
    expect(blocked.currentlyAvailable).toBeGreaterThanOrEqual(400_000);
    expect(blocked.currentlyAvailable).toBeLessThan(400_010);

    const restored = await driver.update({ ...input, points: -300_000 });
    expect(restored.blocked).toBe(false);
    expect(restored.currentlyAvailable).toBeGreaterThanOrEqual(700_000);
    expect(restored.currentlyAvailable).toBeLessThan(700_010);
  });
});
