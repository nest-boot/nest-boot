import {
  GraphQLRateLimitDriver,
  GraphQLRateLimitDriverInput,
  GraphQLRateLimitDriverResult,
} from "./graphql-rate-limit.driver";

interface MemoryBucket {
  currentlyAvailable: number;
  expiresAt: number;
  updatedAt: number;
}

/**
 * Process-local in-memory GraphQL rate limit driver.
 *
 * @remarks
 * Buckets are isolated to one process and are not shared across replicas. Use
 * the Redis driver or a custom distributed driver when limits must be global.
 */
export class MemoryGraphQLRateLimitDriver extends GraphQLRateLimitDriver {
  private readonly buckets = new Map<string, MemoryBucket>();

  /**
   * Applies an atomic in-process bucket update.
   * @param input - Bucket key, limits, and points to consume or restore
   * @returns The bucket state after the update
   */
  update(
    input: GraphQLRateLimitDriverInput,
  ): Promise<GraphQLRateLimitDriverResult> {
    const now = Math.floor(Date.now() / 1000);
    const expirationSeconds = Math.ceil(
      input.maximumAvailable / input.restoreRate,
    );
    const storedBucket = this.buckets.get(input.key);
    const bucket =
      storedBucket && storedBucket.expiresAt > now
        ? storedBucket
        : {
            currentlyAvailable: input.maximumAvailable,
            expiresAt: now + expirationSeconds,
            updatedAt: now,
          };

    const intervalSeconds = now - bucket.updatedAt;
    if (intervalSeconds > 0) {
      bucket.currentlyAvailable = Math.min(
        input.maximumAvailable,
        bucket.currentlyAvailable + input.restoreRate * intervalSeconds,
      );
    }

    bucket.updatedAt = now;
    bucket.expiresAt = now + expirationSeconds;

    const nextAvailable = bucket.currentlyAvailable - input.points;
    const blocked = nextAvailable < 0;
    if (!blocked) {
      bucket.currentlyAvailable = nextAvailable;
    }

    this.buckets.set(input.key, bucket);

    return Promise.resolve({
      blocked,
      currentlyAvailable: bucket.currentlyAvailable,
    });
  }

  /** Clears all process-local buckets. */
  override close(): void {
    this.buckets.clear();
  }
}
