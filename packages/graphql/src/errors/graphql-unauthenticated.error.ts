import { GraphQLError } from "graphql";

/** Reports that a GraphQL operation requires valid authentication. */
export class GraphQLUnauthenticatedError extends GraphQLError {
  /**
   * Creates an authentication error.
   * @param message - Why the caller could not be authenticated.
   */
  constructor(message = "Unauthenticated") {
    super(message, {
      extensions: { code: "UNAUTHENTICATED" },
    });
    this.name = new.target.name;
  }
}
