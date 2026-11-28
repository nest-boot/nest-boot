import type { PublicSchema } from "@mastra/core/schema";
import type {
  DefaultEngineType,
  ExecuteFunctionParams,
  InnerOutput,
  Step,
  StepParams,
} from "@mastra/core/workflows";

type StepStaticKeys =
  | "id"
  | "description"
  | "inputSchema"
  | "outputSchema"
  | "stateSchema"
  | "resumeSchema"
  | "suspendSchema"
  | "requestContextSchema";

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
