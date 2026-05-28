import type { ExecutionContext } from "@nestjs/common";

/** Nest route parameter metadata used to reconstruct decorated method arguments. */
export interface RouteArgumentMetadataValue {
  /** Decorated method parameter index. */
  index: number;
  /** Optional parameter decorator data. */
  data?: unknown;
  /** Custom parameter decorator factory. */
  factory?: (data: unknown, context: ExecutionContext) => unknown;
}
