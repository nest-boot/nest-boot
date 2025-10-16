export interface CostThrottleStatus {
  blocked: boolean;
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface CostResponse {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus?: CostThrottleStatus;
}
