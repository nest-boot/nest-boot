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

interface GraphQLValidationError {
  code: string;
  field: (string | number)[];
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getValidationErrors(
  response: unknown,
): GraphQLValidationError[] | undefined {
  if (!isRecord(response) || !Array.isArray(response.issues)) {
    return undefined;
  }

  const validationErrors: GraphQLValidationError[] = [];

  for (const issue of response.issues) {
    if (
      !isRecord(issue) ||
      typeof issue.code !== "string" ||
      typeof issue.message !== "string" ||
      !Array.isArray(issue.path) ||
      !issue.path.every(
        (segment) => typeof segment === "string" || typeof segment === "number",
      )
    ) {
      return undefined;
    }

    validationErrors.push({
      code: issue.code,
      field: [...issue.path],
      message: issue.message,
    });
  }

  return validationErrors.length > 0 ? validationErrors : undefined;
}

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
      const response: unknown = error.getResponse();
      const message: string =
        typeof response === "string"
          ? response
          : isRecord(response)
            ? typeof response.message === "string"
              ? response.message
              : typeof response.reason === "string"
                ? response.reason
                : "INTERNAL_SERVER_ERROR"
            : "INTERNAL_SERVER_ERROR";
      const validationErrors =
        status === 400 ? getValidationErrors(response) : undefined;

      return new GraphQLError(
        this.debug || error.getStatus() !== 500
          ? message
          : "Internal server error",
        {
          extensions: {
            code: validationErrors ? "BAD_USER_INPUT" : HttpStatus[status],
            ...(validationErrors ? { validationErrors } : {}),
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
