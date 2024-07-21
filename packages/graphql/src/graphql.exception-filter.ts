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

@Catch()
export class GraphQLExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  private readonly debug = process.env.NODE_ENV !== "production";

  constructor(private readonly logger: Logger) {
    super();
  }

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

  transform(error: Error): GraphQLError {
    // 如果是 GraphQL 错误，直接返回
    if (error instanceof GraphQLError) {
      return error;
    }

    // 如果是 Http 错误，转换为 Apollo 错误
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
