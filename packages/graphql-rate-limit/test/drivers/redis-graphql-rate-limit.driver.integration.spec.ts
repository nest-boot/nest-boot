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
