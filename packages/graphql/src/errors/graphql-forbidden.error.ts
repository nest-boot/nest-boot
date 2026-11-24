import { GraphQLError } from "graphql";

/** Reports that the caller lacks permission to access a GraphQL resource. */
export class GraphQLForbiddenError extends GraphQLError {
  /**
   * Creates a forbidden error.
   * @param message - Why access was denied.
   */
  constructor(message = "Forbidden") {
    super(message, {
      extensions: { code: "FORBIDDEN" },
    });
    this.name = new.target.name;
  }
}
