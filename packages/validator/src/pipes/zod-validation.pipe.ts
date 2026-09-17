import {
  type ArgumentMetadata,
  Inject,
  Injectable,
  Optional,
  type PipeTransform,
} from "@nestjs/common";
import type { ZodError } from "zod";

import { ZodValidationException } from "../exceptions/zod-validation.exception.js";
import { getZodSchema } from "../schema/to-zod-schema.js";

/** Creates the exception thrown when a decorated DTO fails validation. */
export type ZodValidationExceptionFactory = (
  error: ZodError,
  metadata: ArgumentMetadata,
) => Error;

/** Options accepted by {@link ZodValidationPipe}. */
export interface ZodValidationPipeOptions {
  /** Overrides the default {@link ZodValidationException}. */
  createValidationException?: ZodValidationExceptionFactory;
}

/** Injection token for optional {@link ZodValidationPipeOptions}. */
export const ZOD_VALIDATION_PIPE_OPTIONS = Symbol(
  "ZOD_VALIDATION_PIPE_OPTIONS",
);

/** Validates decorated NestJS handler arguments with their assembled schema. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  /**
   * Creates a Zod validation pipe.
   *
   * @param options - Exception customization options
   */
  constructor(
    @Optional()
    @Inject(ZOD_VALIDATION_PIPE_OPTIONS)
    private readonly options: ZodValidationPipeOptions = {},
  ) {}

  /**
   * Validates a handler argument and returns Zod's parsed output.
   *
   * @param value - Incoming handler argument
   * @param metadata - NestJS argument metadata
   * @returns Parsed output, or the original value for an undecorated class
   */
  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (typeof metadata.metatype !== "function") {
      return value;
    }

    const schema = getZodSchema(metadata.metatype);

    if (!schema) {
      return value;
    }

    const result = await schema.safeParseAsync(value);

    if (result.success) {
      return result.data;
    }

    throw (
      this.options.createValidationException?.(result.error, metadata) ??
      new ZodValidationException(result.error)
    );
  }
}
