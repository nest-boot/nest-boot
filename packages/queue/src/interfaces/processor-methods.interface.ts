import type { BaseProcessor } from "../processors/base.processor.js";
import type { BaseQueue } from "../queues/base.queue.js";
import type { Job, JobName, JobResult } from "./job.interface.js";
import type { ProcessMethodName } from "./job-name.interface.js";

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Deferred conditional types distinguish exact parameter types from assignable ones. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
type IsAny<T> = 0 extends 1 & T ? true : false;

type ProcessorMethod<J, R> = (
  job: J,
  token?: string,
  signal?: AbortSignal,
) => Promise<R>;

type MethodError<F, J, R, M extends string> = F extends (...args: any[]) => any
  ? Equal<Parameters<F>[0], J> extends true
    ? IsAny<Awaited<ReturnType<F>>> extends true
      ? `${M} must not return any`
      : ReturnType<F> extends Promise<R>
        ? F extends ProcessorMethod<J, R>
          ? never
          : `${M} must accept optional string token and AbortSignal without additional required parameters`
        : `${M} must return a Promise matching its result schema`
    : `${M} must accept its job's Job type`
  : `${M} must be a method`;

type NamedMethodErrors<P, Q extends BaseQueue> = {
  [N in JobName<Q>]: ProcessMethodName<N> extends keyof P
    ? MethodError<
        P[ProcessMethodName<N>],
        Job<Q, N>,
        JobResult<Q, N>,
        ProcessMethodName<N>
      >
    : `Missing required method ${ProcessMethodName<N>}`;
}[JobName<Q>];

type MethodErrors<
  P extends BaseProcessor,
  Q extends BaseQueue,
> = "process" extends keyof P
  ? "Use named processXXX methods; process is not supported"
  : string extends JobName<Q>
    ? "Queues with processors must declare concrete jobSchemas"
    : NamedMethodErrors<P, Q>;

/** Checks every declared job independently, including exact job parameters and result types. */
export type ProcessorContract<P extends BaseProcessor, Q extends BaseQueue> = [
  MethodErrors<P, Q>,
] extends [never]
  ? unknown
  : { readonly "Invalid processor methods": MethodErrors<P, Q> };
