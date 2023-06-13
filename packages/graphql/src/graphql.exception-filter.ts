import {
  type ArgumentsHost,
  Catch,
  type ContextType,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { type Response } from "express";
import { GraphQLError } from "graphql";
import _ from "lodash";

@Catch()
export class GraphQLExceptionFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    if (host.getType<ContextType | "graphql">() === "graphql") {
      this.catchGraphqlException(error);
    }

    if (host.getType() === "http") {
      this.catchHttpException(error, host);
    }
  }

  catchHttpException(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;

    response.status(status).json({
      statusCode: status,
      message: error.message,
    });
  }

  catchGraphqlException(error: Error): Error {
    // 如果是 GraphQL 错误，直接返回
    if (error instanceof GraphQLError) {
      return error;
    }

    // 如果是 Http 错误，转换为 Apollo 错误
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response: string | { message: string } | { reason: string } =
        error.getResponse() as any;

      throw new GraphQLError(
        typeof response === "string" ? response : "INTERNAL_SERVER_ERROR",
        {
          extensions: {
            code: _.findKey(HttpStatus, status),
            stack: error.stack,
          },
        }
      );
    }

    throw new GraphQLError(error.message, {
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
        stack: error.stack,
      },
    });
  }
}
