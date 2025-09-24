import { RequestContext } from "./request-context";

type MethodArgs<T, M extends keyof T> = T[M] extends (...args: infer A) => any
  ? A
  : never;

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
