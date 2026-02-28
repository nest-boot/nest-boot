import {
  type ArgumentsHost,
  Catch,
  type ContextType,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { GqlExceptionFilter } from "@nestjs/graphql";
import { GraphQLError } from "graphql";

/**
 * Global exception filter for GraphQL and HTTP contexts.
 *
 * @remarks
 * Catches all exceptions and converts them to appropriate GraphQL errors
 * or delegates to the base HTTP exception filter. In production, internal
 * error details are hidden from the response.
 */
@Catch()
export class GraphQLExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  /** Whether to include debug information (stack traces, error details) in responses. */
  private readonly debug = process.env.NODE_ENV !== "production";

  /** Creates a new GraphQLExceptionFilter instance.
   * @param logger - NestJS logger for logging exceptions
   */
  constructor(private readonly logger: Logger) {
    super();
  }

  /**
   * Catches and handles exceptions from both GraphQL and HTTP contexts.
   * @param error - The caught exception
   * @param host - The execution context arguments
   * @returns A GraphQL error for GraphQL contexts, or delegates to HTTP handler
   */
  catch(error: Error, host: ArgumentsHost) {
    if (host.getType<ContextType | "graphql">() === "graphql") {
      const graphqlError = this.transform(error);
      this.logger.error(graphqlError.message, { err: graphqlError });
      return graphqlError;
    } else {
      this.logger.error(error.message, { err: error });
      super.catch(error, host);
    }
  }

  /**
   * Transforms a generic error into a GraphQL error.
   * @param error - The original error
   * @returns A standardized GraphQL error with appropriate extensions
   */
  transform(error: Error): GraphQLError {
    if (error instanceof GraphQLError) {
      return error;
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response: any = error.getResponse();
      const message: string =
        typeof response === "string"
          ? response
          : (response.message ?? response.reason ?? "INTERNAL_SERVER_ERROR");

      return new GraphQLError(
        this.debug || error.getStatus() !== 500
          ? message
          : "Internal server error",
        {
          extensions: {
            code: HttpStatus[status],
            ...(this.debug ? { stack: error.stack } : {}),
          },
        },
      );
    }

    return new GraphQLError(
      this.debug ? error.message : "Internal server error",
      {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          ...(this.debug ? { stack: error.stack } : {}),
        },
      },
    );
  }
}
