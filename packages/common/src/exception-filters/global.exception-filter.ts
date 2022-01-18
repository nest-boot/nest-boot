/* eslint-disable no-param-reassign */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApolloError, toApolloError } from "apollo-server-errors";
import { Response } from "express";
import _ from "lodash";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    if ((host.getType() as string) === "graphql") {
      this.catchGraphqlException(exception);
    }

    if (host.getType() === "http") {
      this.catchHttpException(exception, host);
    }
  }

  catchHttpException(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
    });
  }

  catchGraphqlException(
    exception: Error
  ): Error & { extensions: Record<string, unknown> } {
    // 如果是 Apollo 异常，直接返回
    if (exception instanceof ApolloError) {
      return exception;
    }

    // 如果是 Http 异常，转换为 Apollo 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = exception.getResponse();

      let message: string;

      if (typeof response === "string") {
        message = response;
      } else if (typeof response?.message === "string") {
        message = response.message;
      } else if (typeof response?.message?.[0] === "string") {
        [message] = response.message;
      }

      const error = new ApolloError(
        message,
        _.findKey(HttpStatus, (item) => item === status)
      );

      error.stack = exception.stack;

      throw error;
    }

    throw toApolloError(exception);
  }
}
