import type {
  InferStandardSchemaOutput,
  StandardSchemaWithJSON,
} from "@mastra/core/schema";
import type {
  Tool as MastraTool,
  ToolExecuteContext,
  ToolExecutionContext,
} from "@mastra/core/tools";

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
