import { BadRequestException } from "@nestjs/common";
import type { ZodError } from "zod";

/** A serializable, input-free Zod validation error. */
export interface ZodValidationError {
  /** Zod's stable issue code. */
  code: string;
  /** Location of the invalid value within the input. */
  field: (string | number)[];
  /** Human-readable validation message. */
  message: string;
}

/** HTTP response body produced by {@link ZodValidationException}. */
export interface ZodValidationErrorResponse {
  /** HTTP status code. */
  statusCode: 400;
  /** Stable summary suitable for clients. */
  message: "Validation failed";
  /** NestJS error label. */
  error: "Bad Request";
  /** Sanitized field errors without rejected input values. */
  validationErrors: ZodValidationError[];
}

/** A NestJS bad-request exception that retains the original Zod error. */
export class ZodValidationException extends BadRequestException {
  /**
   * Creates a validation exception.
   *
   * @param zodError - The original Zod error
   */
  constructor(private readonly zodError: ZodError) {
    const response: ZodValidationErrorResponse = {
      statusCode: 400,
      message: "Validation failed",
      error: "Bad Request",
      validationErrors: zodError.issues.map((issue) => ({
        code: issue.code,
        field: issue.path.map((segment) =>
          typeof segment === "symbol" ? segment.toString() : segment,
        ),
        message: issue.message,
      })),
    };

    super(response);
  }

  /** Returns the original Zod error for logging or custom exception filters. */
  getZodError(): ZodError {
    return this.zodError;
  }
}
