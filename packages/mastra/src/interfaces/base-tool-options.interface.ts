import type { PublicSchema } from "@mastra/core/schema";
import type {
  Tool as MastraTool,
  ToolAction,
  ToolExecuteContext,
  ToolExecutionContext,
  ValidationError,
} from "@mastra/core/tools";

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
