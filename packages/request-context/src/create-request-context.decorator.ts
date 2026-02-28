import { RequestContext } from "./request-context";

/**
 * Helper type that extracts the argument types of a method.
 */
export type MethodArgs<T, M extends keyof T> = T[M] extends (
  ...args: infer A
) => any
  ? A
  : never;

/**
 * Method decorator that wraps the method execution in a new request context.
 *
 * This is useful for creating request contexts for background jobs, event handlers,
 * or any other code that runs outside of HTTP request handling.
 *
 * @typeParam T - The class type containing the method
 * @typeParam P - The property key of the method
 * @param fn - A function that creates the RequestContext, receiving the class instance and method arguments
 * @returns A method decorator
 *
 * @example Basic usage with a job processor
 * ```typescript
 * import { CreateRequestContext, RequestContext } from '@nest-boot/request-context';
 *
 * class JobProcessor {
 *   @CreateRequestContext((instance, jobData) =>
 *     new RequestContext({ type: 'job', id: jobData.id })
 *   )
 *   async processJob(jobData: { id: string; payload: any }) {
 *     // This code runs within a request context
 *     console.log(`Processing job ${RequestContext.id}`);
 *     // ...
 *   }
 * }
 * ```
 *
 * @example With service injection
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { CreateRequestContext, RequestContext } from '@nest-boot/request-context';
 *
 * @Injectable()
 * class EventHandler {
 *   @CreateRequestContext((instance, event) =>
 *     new RequestContext({
 *       type: 'event',
 *       id: event.correlationId,
 *     })
 *   )
 *   async handleEvent(event: { correlationId: string; data: any }) {
 *     // Access context within the handler
 *     RequestContext.set('eventType', event.data.type);
 *     await this.processEvent(event);
 *   }
 *
 *   private async processEvent(event: any) {
 *     // Context is still available here
 *     const eventType = RequestContext.get('eventType');
 *   }
 * }
 * ```
 */
export function CreateRequestContext<T extends object, P extends keyof T>(
  fn: (instance: T, ...args: MethodArgs<T, P>) => RequestContext,
) {
  return (_target: T, _propertyKey: P, descriptor: PropertyDescriptor) => {
    if (descriptor.value) {
      const original = descriptor.value;

      descriptor.value = function (this: T, ...args: MethodArgs<T, P>) {
        const ctx = fn(this, ...args);
        return RequestContext.run(ctx, () => original.apply(this, args));
      };
    }

    return descriptor;
  };
}
