import type { InferPublicSchema, PublicSchema } from "@mastra/core/schema";
import {
  type DefaultEngineType,
  type Step,
  Workflow as MastraWorkflow,
  type WorkflowErrorCallbackInfo,
  type WorkflowFinishCallbackResult,
  type WorkflowOptions,
  type WorkflowStartCallbackInfo,
} from "@mastra/core/workflows";
import { kebabCase } from "lodash-es";

import type {
  BaseWorkflowConstructor,
  BaseWorkflowLifecycleHooks,
  BaseWorkflowOptions,
  BaseWorkflowSchemas,
} from "../interfaces/base-workflow-options.interface.js";

const BASE_WORKFLOW_MARKER = Symbol("nest-mastra-base-workflow");
/**
 * Non-callable object assigned to `this.then` after `commit()` so:
 * 1. JavaScript/NestJS async DI does not treat the workflow as a Promise Thenable, and
 * 2. Metadata scanners calling `Reflect.getMetadata(key, instance[methodName])`
 *    (such as `@nest-boot/schedule`) safely receive `undefined` instead of throwing `TypeError`.
 */
const NON_THENABLE_SENTINEL = Object.freeze({});

type InferOptionalSchema<TSchema extends PublicSchema | undefined> =
  TSchema extends PublicSchema ? InferPublicSchema<TSchema> : unknown;

/**
 * NestJS-native Mastra workflow base class factory directly extending Mastra `Workflow`.
 *
 * `BaseWorkflow(schemas)` owns exclusively the static definition (`Pick`: `id`, `description`,
 * and schemas) so native Mastra builder methods (`this.then(...)`, `this.branch(...)`,
 * `this.dowhile(...)`, `this.map(...)`, `createRun()`) preserve full, un-erased type checking.
 * `super(options)` owns exclusively runtime configuration (`Omit`, e.g. `metadata`,
 * `retryConfig`, `options`, `schedule`) with full access to DI dependencies.
 * Subclasses may also implement optional `onStart`, `onFinish`, and `onError` class methods.
 * Calling `this.commit()` at the end of the constructor shadows `then` on the instance
 * so NestJS's async DI container does not treat the workflow as a JS Thenable.
 * Automatically derives `id` from the concrete subclass name in kebab-case unless overridden.
 * @param schemas - Static Zod/Standard schema contract
 * @returns Abstract base class extending Mastra `Workflow`
 */
export function BaseWorkflow<
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TStateSchema extends PublicSchema | undefined = undefined,
  TRequestContextSchema extends PublicSchema | undefined = undefined,
>(
  schemas: BaseWorkflowSchemas<
    TInputSchema,
    TOutputSchema,
    TStateSchema,
    TRequestContextSchema
  >,
): BaseWorkflowConstructor<
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  InferOptionalSchema<TStateSchema>,
  InferOptionalSchema<TRequestContextSchema>
> {
  type TInput = InferPublicSchema<TInputSchema>;
  type TOutput = InferPublicSchema<TOutputSchema>;
  type TState = InferOptionalSchema<TStateSchema>;
  type TRequestContext = InferOptionalSchema<TRequestContextSchema>;

  abstract class GeneratedBaseWorkflow
    extends MastraWorkflow<
      DefaultEngineType,
      Step[],
      string,
      TState,
      TInput,
      TOutput,
      TInput,
      TRequestContext,
      1
    >
    implements BaseWorkflowLifecycleHooks
  {
    readonly [BASE_WORKFLOW_MARKER] = true;

    onStart?(info: WorkflowStartCallbackInfo): Promise<void> | void;
    onFinish?(result: WorkflowFinishCallbackResult): Promise<void> | void;
    onError?(errorInfo: WorkflowErrorCallbackInfo): Promise<void> | void;

    constructor(runtimeOptions?: BaseWorkflowOptions) {
      const id = schemas.id ?? kebabCase(new.target.name);
      const mergedOptions: WorkflowOptions = {
        ...runtimeOptions?.options,
      };
      const proto = new.target.prototype as BaseWorkflowLifecycleHooks;
      const instanceRef: { current?: GeneratedBaseWorkflow } = {};

      if (typeof proto.onStart === "function") {
        const externalOnStart = mergedOptions.onStart;
        mergedOptions.onStart = async (info) => {
          await externalOnStart?.(info);
          await instanceRef.current?.onStart?.(info);
        };
      }

      if (typeof proto.onFinish === "function") {
        const externalOnFinish = mergedOptions.onFinish;
        mergedOptions.onFinish = async (result) => {
          await externalOnFinish?.(result);
          await instanceRef.current?.onFinish?.(result);
        };
      }

      if (typeof proto.onError === "function") {
        const externalOnError = mergedOptions.onError;
        mergedOptions.onError = async (errorInfo) => {
          await externalOnError?.(errorInfo);
          await instanceRef.current?.onError?.(errorInfo);
        };
      }

      super({
        ...runtimeOptions,
        id,
        description: schemas.description,
        inputSchema: schemas.inputSchema,
        outputSchema: schemas.outputSchema,
        ...(schemas.stateSchema ? { stateSchema: schemas.stateSchema } : {}),
        ...(schemas.requestContextSchema
          ? { requestContextSchema: schemas.requestContextSchema }
          : {}),
        options: mergedOptions,
      });

      instanceRef.current = this;
    }

    /**
     * Commits the workflow graph and disables `then` on this instance to prevent
     * JavaScript/NestJS async DI Thenable resolution hangs.
     * @returns This committed workflow instance
     */
    override commit() {
      const result = super.commit();

      Object.defineProperty(this, "then", {
        value: NON_THENABLE_SENTINEL,
        configurable: true,
        enumerable: false,
        writable: true,
      });

      return result;
    }
  }

  return GeneratedBaseWorkflow;
}

Object.defineProperty(BaseWorkflow, Symbol.hasInstance, {
  value(instance: unknown): boolean {
    return (
      typeof instance === "object" &&
      instance !== null &&
      BASE_WORKFLOW_MARKER in instance
    );
  },
});
