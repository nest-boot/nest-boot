import type { MastraScorers } from "@mastra/core/evals";
import {
  type InferPublicSchema,
  type InferStandardSchemaOutput,
  type PublicSchema,
  type StandardSchemaWithJSON,
  toStandardSchema,
} from "@mastra/core/schema";
import type { DynamicArgument } from "@mastra/core/types";
import type {
  DefaultEngineType,
  ExecuteFunctionParams,
  InnerOutput,
  Step,
  StepMetadata,
  StepParams,
} from "@mastra/core/workflows";
import { kebabCase } from "lodash-es";

const BASE_STEP_MARKER = Symbol("nest-mastra-base-step");

type StepStaticKeys =
  | "id"
  | "description"
  | "inputSchema"
  | "outputSchema"
  | "stateSchema"
  | "resumeSchema"
  | "suspendSchema"
  | "requestContextSchema";

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

/** Extracts the validated input type from a `BaseStep` subclass or Mastra `Step`. */
export type StepInput<T extends AnyMastraStep> = InferStandardSchemaOutput<
  T["inputSchema"]
>;

/** Extracts the validated output type from a `BaseStep` subclass or Mastra `Step`. */
export type StepOutput<T extends AnyMastraStep> = InferStandardSchemaOutput<
  T["outputSchema"]
>;

/** Extracts the optional workflow state type from a `BaseStep` subclass or Mastra `Step`. */
export type StepState<T extends AnyMastraStep> =
  T["stateSchema"] extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<T["stateSchema"]>
    : unknown;

/** Extracts the optional resume payload type from a `BaseStep` subclass or Mastra `Step`. */
export type StepResume<T extends AnyMastraStep> =
  T["resumeSchema"] extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<T["resumeSchema"]>
    : unknown;

/** Extracts the optional suspend payload type from a `BaseStep` subclass or Mastra `Step`. */
export type StepSuspend<T extends AnyMastraStep> =
  T["suspendSchema"] extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<T["suspendSchema"]>
    : unknown;

/** Extracts the optional request context type from a `BaseStep` subclass or Mastra `Step`. */
export type StepRequestContext<T extends AnyMastraStep> =
  T["requestContextSchema"] extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<T["requestContextSchema"]>
    : unknown;

/** Typed `execute` parameter object derived from a `BaseStep` subclass or Mastra `Step`. */
export type StepExecuteParams<T extends AnyMastraStep> = ExecuteFunctionParams<
  StepState<T>,
  StepInput<T>,
  StepOutput<T>,
  StepResume<T>,
  StepSuspend<T>,
  DefaultEngineType,
  StepRequestContext<T>
>;

/** Static definition (`id`, `description`, and schemas) passed exclusively to `BaseStep(definition)`. */
export type BaseStepSchemas<
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TStateSchema extends PublicSchema | undefined = undefined,
  TResumeSchema extends PublicSchema | undefined = undefined,
  TSuspendSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
> = Omit<
  Pick<
    StepParams<
      string,
      TStateSchema,
      TInputSchema,
      TOutputSchema,
      TResumeSchema,
      TSuspendSchema,
      TRequestContextSchema
    >,
    StepStaticKeys
  >,
  "id"
> & {
  id?: string;
};

/** Runtime options passed exclusively to `super(options)` inside a `BaseStep` subclass. */
export type BaseStepOptions = Omit<
  StepParams<string, any, any, any, any, any, any>,
  StepStaticKeys | "execute"
>;

type InferOptionalSchema<TSchema extends PublicSchema | undefined> =
  TSchema extends PublicSchema ? InferPublicSchema<TSchema> : unknown;

/** Constructor type returned by the `BaseStep(schemas)` class factory. */
export type BaseStepConstructor<
  TInput,
  TOutput,
  TState = unknown,
  TResume = unknown,
  TSuspend = unknown,
  TRequestContext = unknown,
> = abstract new (options?: BaseStepOptions) => Omit<
  Step<
    string,
    TState,
    TInput,
    TOutput,
    TResume,
    TSuspend,
    DefaultEngineType,
    TRequestContext
  >,
  "execute"
> & {
  execute(
    params: ExecuteFunctionParams<
      TState,
      TInput,
      TOutput,
      TResume,
      TSuspend,
      DefaultEngineType,
      TRequestContext
    >,
  ): Promise<TOutput | InnerOutput>;
};

/**
 * NestJS-native Mastra workflow step base class factory.
 *
 * `BaseStep(schemas)` owns exclusively the static definition (`Pick`: `id`, `description`,
 * and schemas) so `execute(...)` and `Workflow.then(...)` preserve full, un-erased Mastra types.
 * `super(options)` owns exclusively runtime configuration (`Omit`, e.g. `retries`, `scorers`,
 * `metadata`) with full access to DI dependencies.
 * Automatically derives `id` from the concrete subclass name in kebab-case unless overridden.
 * @param schemas - Static Zod/Standard schema contract
 * @returns Abstract base class implementing Mastra `Step`
 */
export function BaseStep<
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TStateSchema extends PublicSchema | undefined = undefined,
  TResumeSchema extends PublicSchema | undefined = undefined,
  TSuspendSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
>(
  schemas: BaseStepSchemas<
    TInputSchema,
    TOutputSchema,
    TStateSchema,
    TResumeSchema,
    TSuspendSchema,
    TRequestContextSchema
  >,
): BaseStepConstructor<
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  InferOptionalSchema<TStateSchema>,
  InferOptionalSchema<TResumeSchema>,
  InferOptionalSchema<TSuspendSchema>,
  InferOptionalSchema<TRequestContextSchema>
> {
  type TInput = InferPublicSchema<TInputSchema>;
  type TOutput = InferPublicSchema<TOutputSchema>;
  type TState = InferOptionalSchema<TStateSchema>;
  type TResume = InferOptionalSchema<TResumeSchema>;
  type TSuspend = InferOptionalSchema<TSuspendSchema>;
  type TRequestContext = InferOptionalSchema<TRequestContextSchema>;

  const inputSchema = toStandardSchema(
    schemas.inputSchema,
  ) as StandardSchemaWithJSON<TInput>;
  const outputSchema = toStandardSchema(
    schemas.outputSchema,
  ) as StandardSchemaWithJSON<TOutput>;
  const stateSchema = schemas.stateSchema
    ? (toStandardSchema(schemas.stateSchema) as StandardSchemaWithJSON<TState>)
    : undefined;
  const resumeSchema = schemas.resumeSchema
    ? (toStandardSchema(
        schemas.resumeSchema,
      ) as StandardSchemaWithJSON<TResume>)
    : undefined;
  const suspendSchema = schemas.suspendSchema
    ? (toStandardSchema(
        schemas.suspendSchema,
      ) as StandardSchemaWithJSON<TSuspend>)
    : undefined;
  const requestContextSchema = schemas.requestContextSchema
    ? (toStandardSchema(
        schemas.requestContextSchema,
      ) as StandardSchemaWithJSON<TRequestContext>)
    : undefined;

  abstract class GeneratedBaseStep implements Step<
    string,
    TState,
    TInput,
    TOutput,
    TResume,
    TSuspend,
    DefaultEngineType,
    TRequestContext
  > {
    readonly [BASE_STEP_MARKER] = true;
    readonly id: string;
    readonly description?: string;
    readonly inputSchema = inputSchema;
    readonly outputSchema = outputSchema;
    readonly stateSchema = stateSchema;
    readonly resumeSchema = resumeSchema;
    readonly suspendSchema = suspendSchema;
    readonly requestContextSchema = requestContextSchema;
    readonly retries?: number;
    readonly scorers?: DynamicArgument<MastraScorers>;
    readonly metadata?: StepMetadata;

    constructor(options?: BaseStepOptions) {
      this.id = schemas.id ?? kebabCase(new.target.name);
      this.description = schemas.description;
      this.retries = options?.retries;
      this.scorers = options?.scorers;
      this.metadata = options?.metadata;

      const proto = new.target.prototype as {
        execute: (
          params: ExecuteFunctionParams<
            TState,
            TInput,
            TOutput,
            TResume,
            TSuspend,
            DefaultEngineType,
            TRequestContext
          >,
        ) => Promise<TOutput | InnerOutput>;
      };

      this.execute = (params) => proto.execute.call(this, params);
    }

    abstract execute(
      params: ExecuteFunctionParams<
        TState,
        TInput,
        TOutput,
        TResume,
        TSuspend,
        DefaultEngineType,
        TRequestContext
      >,
    ): Promise<TOutput | InnerOutput>;
  }

  return GeneratedBaseStep;
}

Object.defineProperty(BaseStep, Symbol.hasInstance, {
  value(instance: unknown): boolean {
    return (
      typeof instance === "object" &&
      instance !== null &&
      BASE_STEP_MARKER in instance
    );
  },
});
