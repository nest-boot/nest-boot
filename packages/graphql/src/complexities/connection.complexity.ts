import { type Complexity, type ComplexityEstimatorArgs } from "@nestjs/graphql";

export const connectionComplexity: Complexity = (
  options: ComplexityEstimatorArgs
) => {
  return (
    Number(options.args.first ?? options.args.last ?? 1) *
    options.childComplexity
  );
};
