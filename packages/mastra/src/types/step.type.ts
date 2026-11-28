import type {
  InferStandardSchemaOutput,
  StandardSchemaWithJSON,
} from "@mastra/core/schema";
import type {
  DefaultEngineType,
  ExecuteFunctionParams,
  Step,
} from "@mastra/core/workflows";

export type AnyMastraStep = Step<
  string,
  any,
  any,
  any,
  any,
  any,
  DefaultEngineType,
  any
>;

// Schema extraction must not constrain a subclass's stricter execute parameter.
type MastraStepSchemas = Pick<
  AnyMastraStep,
  | "inputSchema"
  | "outputSchema"
  | "stateSchema"
  | "resumeSchema"
  | "suspendSchema"
  | "requestContextSchema"
>;

/** Extracts the validated input type from a `BaseStep` subclass or Mastra `Step`. */
export type StepInput<T extends MastraStepSchemas> = InferStandardSchemaOutput<
  T["inputSchema"]
>;

/** Extracts the validated output type from a `BaseStep` subclass or Mastra `Step`. */
export type StepOutput<T extends MastraStepSchemas> = InferStandardSchemaOutput<
  T["outputSchema"]
>;

/** Extracts the optional workflow state type from a `BaseStep` subclass or Mastra `Step`. */
export type StepState<T extends MastraStepSchemas> =
  NonNullable<T["stateSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["stateSchema"]>>
    : unknown;

/** Extracts the optional resume payload type from a `BaseStep` subclass or Mastra `Step`. */
export type StepResume<T extends MastraStepSchemas> =
  NonNullable<T["resumeSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["resumeSchema"]>>
    : unknown;

/** Extracts the optional suspend payload type from a `BaseStep` subclass or Mastra `Step`. */
export type StepSuspend<T extends MastraStepSchemas> =
  NonNullable<T["suspendSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["suspendSchema"]>>
    : unknown;

/** Extracts the optional request context type from a `BaseStep` subclass or Mastra `Step`. */
export type StepRequestContext<T extends MastraStepSchemas> =
  NonNullable<T["requestContextSchema"]> extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<NonNullable<T["requestContextSchema"]>>
    : unknown;

/** Typed `execute` parameter object derived from a `BaseStep` subclass or Mastra `Step`. */
export type StepExecuteParams<T extends MastraStepSchemas> =
  ExecuteFunctionParams<
    StepState<T>,
    StepInput<T>,
    StepOutput<T>,
    StepResume<T>,
    StepSuspend<T>,
    DefaultEngineType,
    StepRequestContext<T>
  >;
