import type { ComplexityEstimatorArgs } from "@nestjs/graphql";

/**
 * Field complexity arguments with the resolved value available during cost settlement.
 * @template Result - The value returned by the field resolver.
 */
export type FieldComplexityEstimatorArgs<Result = unknown> =
  ComplexityEstimatorArgs & {
    /** Provided by the rate limiter after the field resolver succeeds. */
    resolved?: { result: Result | null | undefined };
  };
