import { HttpStatus } from "@nestjs/common";
import { GraphQLError } from "graphql";

/** Rejects a throttled GraphQL operation with HTTP 429 in Apollo Server. */
export class GraphQLTooManyRequestsError extends GraphQLError {
  /**
   * Creates an error for a rate-limit rejection before operation execution.
   * @param message - Why the operation was rejected.
   */
  constructor(message = "Too Many Requests") {
    super(message, {
      extensions: {
        code: "TOO_MANY_REQUESTS",
        http: { status: HttpStatus.TOO_MANY_REQUESTS },
      },
    });
    this.name = new.target.name;
  }
}
