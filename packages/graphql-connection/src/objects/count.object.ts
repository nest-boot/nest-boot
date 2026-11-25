import {
  type ComplexityEstimator,
  Field,
  Int,
  ObjectType,
} from "@nest-boot/graphql";

import { CountPrecision } from "../enums/count-precision.enum.js";
import { COUNT_COMPLEXITY_EXTENSION } from "../graphql-connection.constants.js";
import { createCountComplexity } from "../utils/create-connection-complexity.js";

const countComplexity = createCountComplexity();

/** A bounded count of the records matching a query. */
@ObjectType()
export class Count {
  /**
   * Prices a count from the filter scalar declared on the resolver.
   * @param context - The GraphQL field and its coerced count arguments.
   * @returns The base count cost and its filter cost.
   */
  static readonly complexity: ComplexityEstimator = (context) => {
    let filterType = context.field.args.find(
      ({ name }) => name === "filter",
    )?.type;
    while (filterType && "ofType" in filterType) {
      filterType = filterType.ofType;
    }
    const estimator = filterType?.extensions[COUNT_COMPLEXITY_EXTENSION];
    return typeof estimator === "function"
      ? (estimator as ComplexityEstimator)(context)
      : countComplexity(context);
  };

  @Field(() => Int, { complexity: 0 })
  count!: number;

  @Field(() => CountPrecision, { complexity: 0 })
  precision!: CountPrecision;
}
