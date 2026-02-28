/** Throttle status information for rate-limited queries. */
export interface CostThrottleStatus {
  /** Whether the request is currently blocked due to rate limiting. */
  blocked: boolean;
  /** Maximum cost budget available. */
  maximumAvailable: number;
  /** Remaining cost budget currently available. */
  currentlyAvailable: number;
  /** Rate at which cost budget restores (points per second). */
  restoreRate: number;
}

/** Response containing query cost and throttle status information. */
export interface CostResponse {
  /** The estimated cost of the query before execution. */
  requestedQueryCost: number;
  /** The actual cost of the query after execution. */
  actualQueryCost: number;
  /** Current throttle status, if rate limiting is active. */
  throttleStatus?: CostThrottleStatus;
}
