import {
  type Complexity,
  type ComplexityEstimatorArgs,
} from "@nest-boot/graphql";

import { connectionPageSize } from "../utils/connection-page-size.util.js";

/**
 * Complexity estimator for connection fields (Relay-style pagination).
 *
 * @remarks
 * Multiplies `childComplexity` by the page size (`first` or `last` argument),
 * defaulting to 1 if neither is specified.
 *
 * @param options - The complexity estimator arguments
 * @returns The calculated complexity value
 */
export const connectionComplexity: Complexity = (
  options: ComplexityEstimatorArgs,
) => {
  return connectionPageSize(options.args, 1) * options.childComplexity;
};
