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
    [{ first: 0 }, 0],
    [{ first: null, last: 2 }, 4],
  ])("uses the requested page size from %p", (args, expected) => {
    expect(
      estimator({
        args,
        childComplexity: 2,
      } as unknown as ComplexityEstimatorArgs),
    ).toBe(expected);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2"])(
    "rejects invalid page sizes %s before multiplying cost",
    (value) => {
      for (const args of [
        { first: value },
        { last: value },
        { first: 1, last: value },
      ]) {
        expect(() =>
          estimator({
            args,
            childComplexity: 2,
          } as unknown as ComplexityEstimatorArgs),
        ).toThrow("non-negative safe integer");
      }
    },
  );
});
