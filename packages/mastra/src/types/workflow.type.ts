import type {
  InferStandardSchemaOutput,
  StandardSchemaWithJSON,
} from "@mastra/core/schema";
import type { AnyWorkflow } from "@mastra/core/workflows";

/** Extracts the validated input type from a `BaseWorkflow` subclass or Mastra `Workflow`. */
export type WorkflowInput<T extends AnyWorkflow> = InferStandardSchemaOutput<
  T["inputSchema"]
>;

/** Extracts the validated output type from a `BaseWorkflow` subclass or Mastra `Workflow`. */
export type WorkflowOutput<T extends AnyWorkflow> = InferStandardSchemaOutput<
  T["outputSchema"]
>;

/** Extracts the optional state type from a `BaseWorkflow` subclass or Mastra `Workflow`. */
export type WorkflowState<T extends AnyWorkflow> =
  NonNullable<T["stateSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["stateSchema"]>>
    : unknown;

/** Extracts the optional request context type from a `BaseWorkflow` subclass or Mastra `Workflow`. */
export type WorkflowRequestContext<T extends AnyWorkflow> =
  NonNullable<T["requestContextSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["requestContextSchema"]>>
    : unknown;
