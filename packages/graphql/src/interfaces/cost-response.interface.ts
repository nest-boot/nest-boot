export interface CostThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface CostResponse {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus?: CostThrottleStatus;
}
