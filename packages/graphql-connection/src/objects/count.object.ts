import {
  type ComplexityEstimator,
  Field,
  Int,
  ObjectType,
} from "@nest-boot/graphql";
import { getNamedType } from "graphql/index.js";

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
    const filter = context.field.args.find(({ name }) => name === "filter");
    const estimator =
      filter &&
      getNamedType(filter.type).extensions[COUNT_COMPLEXITY_EXTENSION];
    return typeof estimator === "function"
      ? (estimator as ComplexityEstimator)(context)
      : countComplexity(context);
  };

  @Field(() => Int, { complexity: 0 })
  count!: number;

  @Field(() => CountPrecision, { complexity: 0 })
  precision!: CountPrecision;
}
