/** Input for one atomic rate limit bucket update. */
export interface GraphQLRateLimitDriverInput {
  /** Fully qualified bucket key. */
  key: string;
  /** Maximum number of points that the bucket can hold. */
  maximumAvailable: number;
  /** Number of points restored per second. */
  restoreRate: number;
  /** Points to consume; negative values restore points. */
  points: number;
}

/** Result returned by a rate limit driver update. */
export interface GraphQLRateLimitDriverResult {
  /** Whether the requested points could not be consumed. */
  blocked: boolean;
  /** Points remaining after the update. */
  currentlyAvailable: number;
}

/**
 * Storage backend contract for GraphQL rate limit buckets.
 *
 * @remarks
 * Implementations must update a bucket atomically so concurrent requests cannot
 * consume the same points.
 */
export abstract class GraphQLRateLimitDriver {
  /**
   * Applies one atomic update to a rate limit bucket.
   * @param input - Bucket key, limits, and points to consume or restore
   * @returns The bucket state after the update
   */
  abstract update(
    input: GraphQLRateLimitDriverInput,
  ): Promise<GraphQLRateLimitDriverResult>;

  /** Releases resources owned by the driver during application shutdown. */
  close(): Promise<void> | void {
    return undefined;
  }
}
