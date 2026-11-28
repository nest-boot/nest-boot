import type { InferPublicSchema, PublicSchema } from "@mastra/core/schema";
import {
  Tool as MastraTool,
  type ToolExecuteContext,
  type ToolExecutionContext,
  type ValidationError,
} from "@mastra/core/tools";
import { kebabCase } from "lodash-es";

import type {
  BaseToolConstructor,
  BaseToolOptions,
  BaseToolSchemas,
} from "../interfaces/base-tool-options.interface.js";

const BASE_TOOL_MARKER = Symbol("nest-mastra-base-tool");

type SchemaLike = PublicSchema | undefined;

type InferOptionalSchema<TSchema extends SchemaLike> =
  TSchema extends PublicSchema ? InferPublicSchema<TSchema> : unknown;

/**
 * NestJS-native Mastra tool base class factory.
 *
 * `BaseTool(definition)` owns exclusively the static definition (`id`, `title`,
 * `description`, and schemas) so `execute(...)` preserves full, un-erased Mastra types
 * while retaining Mastra's built-in `Tool` input/output/requestContext validation wrapper.
 * `super(options)` owns exclusively runtime configuration (e.g. `requireApproval`,
 * `beforeApproval`, `toModelOutput`, `mcp`, `providerOptions`) with full access to DI dependencies.
 * Automatically derives `id` from the concrete subclass name in kebab-case unless overridden.
 * @param definition - Static tool metadata and Zod/Standard schema contract
 * @returns Abstract base class extending Mastra `Tool`
 */
export function BaseTool<
  TInputSchema extends SchemaLike = undefined,
  TOutputSchema extends SchemaLike = undefined,
  TSuspendSchema extends SchemaLike = undefined,
  TResumeSchema extends SchemaLike = undefined,
  TRequestContextSchema extends SchemaLike = undefined,
>(
  definition: BaseToolSchemas<
    TInputSchema,
    TOutputSchema,
    TSuspendSchema,
    TResumeSchema,
    TRequestContextSchema
  >,
): BaseToolConstructor<
  InferOptionalSchema<TInputSchema>,
  InferOptionalSchema<TOutputSchema>,
  InferOptionalSchema<TSuspendSchema>,
  InferOptionalSchema<TResumeSchema>,
  InferOptionalSchema<TRequestContextSchema>
> {
  type TInput = InferOptionalSchema<TInputSchema>;
  type TOutput = InferOptionalSchema<TOutputSchema>;
  type TSuspend = InferOptionalSchema<TSuspendSchema>;
  type TResume = InferOptionalSchema<TResumeSchema>;
  type TRequestContext = InferOptionalSchema<TRequestContextSchema>;
  type TContext = ToolExecutionContext<TSuspend, TResume, TRequestContext>;
  type TExecContext = ToolExecuteContext<TContext, TRequestContext>;

  const MastraToolBase = MastraTool as unknown as new (
    opts: ConstructorParameters<
      typeof MastraTool<
        TInput,
        TOutput,
        TSuspend,
        TResume,
        TContext,
        string,
        TRequestContext
      >
    >[0],
  ) => Omit<
    MastraTool<
      TInput,
      TOutput,
      TSuspend,
      TResume,
      TContext,
      string,
      TRequestContext
    >,
    "execute"
  >;

  abstract class GeneratedBaseTool extends MastraToolBase {
    readonly [BASE_TOOL_MARKER] = true;

    constructor(
      options?: BaseToolOptions<
        TInput,
        TOutput,
        TSuspend,
        TResume,
        TRequestContext
      >,
    ) {
      const proto = new.target.prototype as {
        execute: (
          inputData: TInput,
          context: TExecContext,
        ) => Promise<TOutput | ValidationError>;
      };

      const instanceRef: { current?: GeneratedBaseTool } = {};

      super({
        ...options,
        id: definition.id ?? kebabCase(new.target.name),
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema as PublicSchema<TInput> | undefined,
        outputSchema: definition.outputSchema as
          | PublicSchema<TOutput>
          | undefined,
        suspendSchema: definition.suspendSchema as
          | PublicSchema<TSuspend>
          | undefined,
        resumeSchema: definition.resumeSchema as
          | PublicSchema<TResume>
          | undefined,
        requestContextSchema: definition.requestContextSchema as
          | PublicSchema<TRequestContext, any>
          | undefined,
        execute: (inputData, context) =>
          proto.execute.call(instanceRef.current, inputData, context),
      });

      instanceRef.current = this;
    }

    abstract execute(
      inputData: TInput,
      context: TExecContext,
    ): Promise<TOutput | ValidationError>;
  }

  return GeneratedBaseTool;
}

Object.defineProperty(BaseTool, Symbol.hasInstance, {
  value(instance: unknown): boolean {
    return (
      typeof instance === "object" &&
      instance !== null &&
      BASE_TOOL_MARKER in instance
    );
  },
});
