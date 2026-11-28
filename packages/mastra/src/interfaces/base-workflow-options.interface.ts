import type { InferPublicSchema, PublicSchema } from "@mastra/core/schema";
import type {
  DefaultEngineType,
  Step,
  Workflow as MastraWorkflow,
  WorkflowConfig,
  WorkflowErrorCallbackInfo,
  WorkflowFinishCallbackResult,
  WorkflowStartCallbackInfo,
} from "@mastra/core/workflows";

type WorkflowStaticKeys =
  | "id"
  | "description"
  | "inputSchema"
  | "outputSchema"
  | "stateSchema"
  | "requestContextSchema";

type InferOptionalSchema<TSchema extends PublicSchema | undefined> =
  TSchema extends PublicSchema ? InferPublicSchema<TSchema> : unknown;

/** Static definition (`id`, `description`, and schemas) passed exclusively to `BaseWorkflow(definition)`. */
export type BaseWorkflowSchemas<
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TStateSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
> = Omit<
  Pick<
    WorkflowConfig<
      string,
      InferOptionalSchema<TStateSchema>,
      InferPublicSchema<TInputSchema>,
      InferPublicSchema<TOutputSchema>,
      Step[],
      InferOptionalSchema<TRequestContextSchema>
    >,
    WorkflowStaticKeys
  >,
  "id"
> & {
  id?: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  stateSchema?: TStateSchema;
  requestContextSchema?: TRequestContextSchema;
};

/** Runtime options passed exclusively to `super(options)` inside a `BaseWorkflow` subclass. */
export type BaseWorkflowOptions = Omit<
  WorkflowConfig<string, any, any, any, Step[], any>,
  WorkflowStaticKeys | "mastra" | "steps"
>;

/** Optional lifecycle hooks subclasses may implement as class methods. */
export interface BaseWorkflowLifecycleHooks {
  onStart?(info: WorkflowStartCallbackInfo): Promise<void> | void;
  onFinish?(result: WorkflowFinishCallbackResult): Promise<void> | void;
  onError?(errorInfo: WorkflowErrorCallbackInfo): Promise<void> | void;
}

/** Constructor type returned by the `BaseWorkflow(schemas)` class factory. */
export type BaseWorkflowConstructor<
  TInput,
  TOutput,
  TState = unknown,
  TRequestContext = unknown,
> = abstract new (
  options?: BaseWorkflowOptions,
) => MastraWorkflow<
  DefaultEngineType,
  Step[],
  string,
  TState,
  TInput,
  TOutput,
  TInput,
  TRequestContext,
  1
> &
  BaseWorkflowLifecycleHooks;
