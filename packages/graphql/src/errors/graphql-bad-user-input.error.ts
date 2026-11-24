import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";

/** Reports invalid input with the GraphQL error code `BAD_USER_INPUT`. */
export class GraphQLBadUserInputError extends GraphQLError {
  /**
   * Creates an input error.
   * @param message - What is invalid about the input.
   */
  constructor(message: string) {
    super(message, {
      extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT },
    });
    this.name = new.target.name;
  }
}
