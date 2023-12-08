import {
  type ArgumentsHost,
  Catch,
  type ContextType,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { GqlExceptionFilter } from "@nestjs/graphql";
import { GraphQLError } from "graphql";

@Catch()
export class GraphQLExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  catch(error: Error, host: ArgumentsHost) {
    if (host.getType<ContextType | "graphql">() === "graphql") {
      return this.transform(error);
    }

    super.catch(error, host);
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
          : response.message ?? response.reason ?? "INTERNAL_SERVER_ERROR";

      return new GraphQLError(message, {
        extensions: {
          code: HttpStatus[status],
          stack: error.stack,
        },
      });
    }

    return new GraphQLError(error.message, {
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
        stack: error.stack,
      },
    });
  }
}
