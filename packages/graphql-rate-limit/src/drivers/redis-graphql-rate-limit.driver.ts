import type Redis from "ioredis";

import {
  GraphQLRateLimitDriver,
  GraphQLRateLimitDriverInput,
  GraphQLRateLimitDriverResult,
} from "./graphql-rate-limit.driver";

const REDIS_COMMAND = "GRAPHQL_RATE_LIMIT";

interface RedisRateLimitClient {
  GRAPHQL_RATE_LIMIT(
    key: string,
    maximumAvailable: number,
    restoreRate: number,
    points: number,
  ): Promise<[number | null, number | string]>;
}

/** Redis-backed distributed GraphQL rate limit driver. */
export class RedisGraphQLRateLimitDriver extends GraphQLRateLimitDriver {
  /**
   * Creates a Redis-backed driver and registers its atomic Lua command.
   * @param redis - Redis client owned by this driver
   */
  constructor(private readonly redis: Redis) {
    super();
    this.redis.defineCommand(REDIS_COMMAND, {
      numberOfKeys: 1,
      lua: /* lua */ `
        local currentTimestamp = redis.call("TIME")[1]

        local bucketKey = KEYS[1]
        local maximumAvailable = tonumber(ARGV[1])
        local restoreRate = tonumber(ARGV[2])
        local points = tonumber(ARGV[3])

        local keyExpireSeconds = math.ceil(maximumAvailable / restoreRate)

        local currentlyAvailable = redis.call("HGET", bucketKey, "currentlyAvailable")
        if not currentlyAvailable then
          currentlyAvailable = maximumAvailable
        end

        local updatedTimestamp = redis.call("HGET", bucketKey, "updatedTimestamp")
        if not updatedTimestamp then
          updatedTimestamp = currentTimestamp
        end

        redis.call("HSET", bucketKey, "updatedTimestamp", currentTimestamp)
        redis.call("EXPIRE", bucketKey, keyExpireSeconds)

        local intervalSeconds = currentTimestamp - updatedTimestamp
        if intervalSeconds > 0 then
          currentlyAvailable = math.min(
            (restoreRate * intervalSeconds) + currentlyAvailable,
            maximumAvailable
          )
          redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
        end

        local nextAvailable = currentlyAvailable - points
        if nextAvailable >= 0 then
          currentlyAvailable = nextAvailable
          redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
          return { false, currentlyAvailable }
        end

        return { true, currentlyAvailable }
      `,
    });
  }

  /**
   * Applies an atomic Redis bucket update.
   * @param input - Bucket key, limits, and points to consume or restore
   * @returns The bucket state after the update
   */
  async update(
    input: GraphQLRateLimitDriverInput,
  ): Promise<GraphQLRateLimitDriverResult> {
    const [blocked, currentlyAvailable] = await (
      this.redis as unknown as RedisRateLimitClient
    ).GRAPHQL_RATE_LIMIT(
      input.key,
      input.maximumAvailable,
      input.restoreRate,
      input.points,
    );

    return {
      blocked: Boolean(blocked),
      currentlyAvailable: Number(currentlyAvailable),
    };
  }

  /** Gracefully closes the Redis connection owned by this driver. */
  override async close(): Promise<void> {
    await this.redis.quit();
  }
}
