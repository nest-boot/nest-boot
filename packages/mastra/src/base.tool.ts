import {
  type InferPublicSchema,
  type InferStandardSchemaOutput,
  type PublicSchema,
  type StandardSchemaWithJSON,
} from "@mastra/core/schema";
import {
  Tool as MastraTool,
  type ToolAction,
  type ToolExecuteContext,
  type ToolExecutionContext,
  type ValidationError,
} from "@mastra/core/tools";
import { kebabCase } from "lodash-es";

import {
  GET_TOOL_ORIGINAL_EXECUTE,
  getActiveToolExecuteDelegate,
  SET_TOOL_EXECUTE_DELEGATE,
} from "./tool-guard.js";

const BASE_TOOL_MARKER = Symbol("nest-mastra-base-tool");

type ToolStaticKeys =
  | "id"
  | "title"
  | "description"
  | "inputSchema"
  | "outputSchema"
  | "suspendSchema"
  | "resumeSchema"
  | "requestContextSchema";

type SchemaLike = PublicSchema | undefined;

type InferOptionalSchema<TSchema extends SchemaLike> =
  TSchema extends PublicSchema ? InferPublicSchema<TSchema> : unknown;

export type AnyMastraTool = MastraTool<any, any, any, any, any, any, any>;

// Schema extraction must not constrain a subclass's stricter execute context.
type MastraToolSchemas = Pick<
  AnyMastraTool,
  | "inputSchema"
  | "outputSchema"
  | "suspendSchema"
  | "resumeSchema"
  | "requestContextSchema"
>;

/** Extracts the validated input type from a `BaseTool` subclass or Mastra `Tool`. */
export type ToolInput<T extends MastraToolSchemas> =
  NonNullable<T["inputSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["inputSchema"]>>
    : unknown;

/** Extracts the validated output type from a `BaseTool` subclass or Mastra `Tool`. */
export type ToolOutput<T extends MastraToolSchemas> =
  NonNullable<T["outputSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["outputSchema"]>>
    : unknown;

/** Extracts the optional suspend payload type from a `BaseTool` subclass or Mastra `Tool`. */
export type ToolSuspend<T extends MastraToolSchemas> =
  NonNullable<T["suspendSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["suspendSchema"]>>
    : unknown;

/** Extracts the optional resume payload type from a `BaseTool` subclass or Mastra `Tool`. */
export type ToolResume<T extends MastraToolSchemas> =
  NonNullable<T["resumeSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["resumeSchema"]>>
    : unknown;

/**
 * Extracts the optional request context type from a `BaseTool` subclass or Mastra `Tool`.
 * Infers from Tool's generic because PublicSchema also includes untyped JSON schemas.
 */
export type ToolRequestContext<T extends MastraToolSchemas> =
  T extends Omit<
    MastraTool<any, any, any, any, any, any, infer TRequestContext>,
    "execute"
  >
    ? TRequestContext
    : unknown;

/** Typed `execute` context parameter derived from a `BaseTool` subclass or Mastra `Tool`. */
export type ToolContext<T extends MastraToolSchemas> = ToolExecuteContext<
  ToolExecutionContext<ToolSuspend<T>, ToolResume<T>, ToolRequestContext<T>>,
  ToolRequestContext<T>
>;

/** Static definition (`id`, `title`, `description`, and schemas) passed exclusively to `BaseTool(definition)`. */
export interface BaseToolSchemas<
  TInputSchema extends SchemaLike = undefined,
  TOutputSchema extends SchemaLike = undefined,
  TSuspendSchema extends SchemaLike = undefined,
  TResumeSchema extends SchemaLike = undefined,
  TRequestContextSchema extends SchemaLike = undefined,
> {
  /** Unique identifier for the tool. Defaults to kebab-case of the concrete subclass name. */
  id?: string;
  /** Display name for UIs and MCP clients. Never sent to the model. */
  title?: string;
  /** Description of what the tool does. */
  description: string;
  /** Optional schema for validating input parameters. */
  inputSchema?: TInputSchema;
  /** Optional schema for validating output structure. */
  outputSchema?: TOutputSchema;
  /** Optional schema for suspend operation data. */
  suspendSchema?: TSuspendSchema;
  /** Optional schema for resume operation data. */
  resumeSchema?: TResumeSchema;
  /** Optional schema for validating request context values. */
  requestContextSchema?: TRequestContextSchema;
}

/** Runtime options passed exclusively to `super(options)` inside a `BaseTool` subclass. */
export type BaseToolOptions<
  TInput = unknown,
  TOutput = unknown,
  TSuspend = unknown,
  TResume = unknown,
  TRequestContext = unknown,
> = Omit<
  ToolAction<
    TInput,
    TOutput,
    TSuspend,
    TResume,
    ToolExecutionContext<TSuspend, TResume, TRequestContext>,
    string,
    TRequestContext
  >,
  ToolStaticKeys | "execute" | "renderOnly"
>;

/** Constructor type returned by the `BaseTool(definition)` class factory. */
export type BaseToolConstructor<
  TInput = unknown,
  TOutput = unknown,
  TSuspend = unknown,
  TResume = unknown,
  TRequestContext = unknown,
> = abstract new (
  options?: BaseToolOptions<
    TInput,
    TOutput,
    TSuspend,
    TResume,
    TRequestContext
  >,
) => Omit<
  MastraTool<
    TInput,
    TOutput,
    TSuspend,
    TResume,
    ToolExecutionContext<TSuspend, TResume, TRequestContext>,
    string,
    TRequestContext
  >,
  "execute"
> & {
  execute(
    inputData: TInput,
    context?: ToolExecuteContext<
      ToolExecutionContext<TSuspend, TResume, TRequestContext>,
      TRequestContext
    >,
  ): Promise<TOutput | ValidationError>;
};

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

      const delegate: {
        execute?: (
          inputData: TInput,
          context: TExecContext,
        ) => Promise<TOutput | ValidationError>;
      } = {};

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
        execute: (inputData, context) => {
          const activeDelegate = getActiveToolExecuteDelegate(this) as
            | ((
                inputData: TInput,
                context: TExecContext,
              ) => Promise<TOutput | ValidationError>)
            | undefined;
          const targetDelegate = activeDelegate ?? delegate.execute;
          if (!targetDelegate) {
            throw new Error("BaseTool execute delegate is not initialized");
          }
          return targetDelegate(inputData, context);
        },
      });

      delegate.execute = (inputData, context) =>
        proto.execute.call(this, inputData, context);

      Object.defineProperty(this, GET_TOOL_ORIGINAL_EXECUTE, {
        value: () => proto.execute,
        configurable: true,
        enumerable: false,
        writable: false,
      });

      Object.defineProperty(this, SET_TOOL_EXECUTE_DELEGATE, {
        value: (
          fn: (
            inputData: TInput,
            context: TExecContext,
          ) => Promise<TOutput | ValidationError>,
        ) => {
          delegate.execute = fn;
        },
        configurable: true,
        enumerable: false,
        writable: false,
      });
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
