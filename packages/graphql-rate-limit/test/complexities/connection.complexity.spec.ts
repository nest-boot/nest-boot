import type { ComplexityEstimatorArgs } from "@nest-boot/graphql";

import { connectionComplexity } from "../../src/complexities/index.js";

describe("connectionComplexity", () => {
  const estimator = connectionComplexity as (
    options: ComplexityEstimatorArgs,
  ) => number;

  it.each([
    [{ first: 3 }, 6],
    [{ last: 4 }, 8],
    [{}, 2],
  ])("uses the requested page size from %p", (args, expected) => {
    expect(
      estimator({
        args,
        childComplexity: 2,
      } as unknown as ComplexityEstimatorArgs),
    ).toBe(expected);
  });
});
