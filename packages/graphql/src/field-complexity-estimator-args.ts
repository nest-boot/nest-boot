import type { ComplexityEstimatorArgs } from "@nestjs/graphql";

/** Field complexity arguments with the resolved value available during cost settlement. */
export type FieldComplexityEstimatorArgs = ComplexityEstimatorArgs & {
  /** Provided by the rate limiter after the field resolver completes. */
  execution?: { result: unknown };
};
