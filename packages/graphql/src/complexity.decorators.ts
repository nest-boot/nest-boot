import { applyDecorators } from "@nestjs/common";
import {
  type ComplexityEstimator,
  Extensions,
  Field as NestField,
  type FieldOptions as NestFieldOptions,
  Mutation as NestMutation,
  type MutationOptions as NestMutationOptions,
  Query as NestQuery,
  type QueryOptions as NestQueryOptions,
  ResolveField as NestResolveField,
  type ResolveFieldOptions as NestResolveFieldOptions,
  type ReturnTypeFunc,
  type ReturnTypeFuncValue,
} from "@nestjs/graphql";

import { defaultComplexityForField } from "./field-complexity-defaults.js";
import type { FieldComplexityEstimatorArgs } from "./field-complexity-estimator-args.js";

// The last Nest Field overload infers its options from the return type function.
type NativeFieldOptions<T extends ReturnTypeFuncValue> = NonNullable<
  Parameters<typeof NestField<T>>[1]
>;

type ResolvedValue<T extends ReturnTypeFuncValue> =
  NativeFieldOptions<T>["defaultValue"];

type ComplexityCallback<Result> = (
  args: FieldComplexityEstimatorArgs<Result>,
) => ReturnType<ComplexityEstimator>;

type WithComplexity<Options, Result> = Options extends unknown
  ? Omit<Options, "complexity"> & {
      complexity?: number | ComplexityCallback<Result>;
    }
  : never;

/**
 * Defines a reusable field complexity callback with a typed resolver result.
 * @param _type - The return type reference, such as a class or a list of that class.
 * @param callback - The field complexity callback.
 * @returns The original callback.
 */
export function defineComplexity<T extends ReturnTypeFuncValue>(
  _type: T,
  callback: ComplexityCallback<ResolvedValue<NoInfer<T>>>,
): ComplexityCallback<ResolvedValue<T>> {
  return callback;
}

export type QueryOptions<T = any, Result = unknown> = WithComplexity<
  NestQueryOptions<T>,
  Result
>;
type NativeMutationOptions<T = any> = NestMutationOptions<T> & {
  /** Base cost of executing this mutation. Defaults to 10. */
  mutationComplexity?: number;
};
export type MutationOptions<T = any, Result = unknown> = WithComplexity<
  NativeMutationOptions<T>,
  Result
>;
export type ResolveFieldOptions<T = any, Result = unknown> = WithComplexity<
  NestResolveFieldOptions<T>,
  Result
>;
export type FieldOptions<T = any, Result = unknown> = WithComplexity<
  NestFieldOptions<T>,
  Result
>;

interface RootResolverDecorator<Options> {
  (name?: string): MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    typeFunc: ReturnTypeFunc<T>,
    options?: WithComplexity<Options, ResolvedValue<NoInfer<T>>>,
  ): MethodDecorator;
}

interface ResolveFieldDecorator {
  (options?: ResolveFieldOptions): MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    typeFunc: ReturnTypeFunc<T>,
    options?: ResolveFieldOptions<any, ResolvedValue<NoInfer<T>>>,
  ): MethodDecorator;
  (name?: string, options?: ResolveFieldOptions): MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    name: string | undefined,
    typeFunc?: ReturnTypeFunc<T>,
    options?: ResolveFieldOptions<any, ResolvedValue<NoInfer<T>>>,
  ): MethodDecorator;
}

interface FieldDecorator {
  (): PropertyDecorator & MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    options: WithComplexity<NativeFieldOptions<T>, unknown>,
  ): PropertyDecorator & MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    typeFunc?: ReturnTypeFunc<T>,
    options?: WithComplexity<NativeFieldOptions<T>, ResolvedValue<NoInfer<T>>>,
  ): PropertyDecorator & MethodDecorator;
}

/**
 * Decorates a root resolver and records its return type for default complexity.
 * @param decorator - The native Nest root field decorator.
 * @param nameOrType - The root field name or return type function.
 * @param options - The native field options.
 * @returns The decorated root resolver.
 */
function rootFieldWithDefaultComplexity(
  decorator: typeof NestQuery,
  nameOrType?: string | ReturnTypeFunc,
  options?: NestQueryOptions,
): MethodDecorator {
  if (typeof nameOrType === "function") {
    return applyDecorators(
      decorator(nameOrType, options),
      defaultComplexityForField(nameOrType),
    );
  }
  return nameOrType === undefined ? decorator() : decorator(nameOrType);
}

export const Query: RootResolverDecorator<NestQueryOptions> = (
  nameOrType?: string | ReturnTypeFunc,
  options?: NestQueryOptions,
) => rootFieldWithDefaultComplexity(NestQuery, nameOrType, options);

export const Mutation: RootResolverDecorator<NativeMutationOptions> = (
  nameOrType?: string | ReturnTypeFunc,
  options?: NativeMutationOptions,
) => {
  const { mutationComplexity, ...fieldOptions } = options ?? {};
  const decorator = rootFieldWithDefaultComplexity(
    NestMutation,
    nameOrType,
    fieldOptions,
  );
  return mutationComplexity === undefined
    ? decorator
    : applyDecorators(decorator, Extensions({ mutationComplexity }));
};

export const ResolveField: ResolveFieldDecorator = (
  nameOrTypeOrOptions?: string | ReturnTypeFunc | NestResolveFieldOptions,
  typeOrOptions?: ReturnTypeFunc | NestResolveFieldOptions,
  options?: NestResolveFieldOptions,
) => {
  const typeFn =
    typeof nameOrTypeOrOptions === "function"
      ? nameOrTypeOrOptions
      : typeof nameOrTypeOrOptions === "string" &&
          typeof typeOrOptions === "function"
        ? typeOrOptions
        : undefined;
  const decorator: MethodDecorator = Reflect.apply(
    NestResolveField,
    undefined,
    [nameOrTypeOrOptions, typeOrOptions, options],
  );
  return applyDecorators(decorator, defaultComplexityForField(typeFn));
};

export const Field: FieldDecorator = (
  typeOrOptions?: ReturnTypeFunc | NestFieldOptions,
  options?: NestFieldOptions,
) => {
  const decorator: PropertyDecorator & MethodDecorator = Reflect.apply(
    NestField,
    undefined,
    [typeOrOptions, options],
  );
  const typeFn =
    typeof typeOrOptions === "function" ? typeOrOptions : undefined;
  return applyDecorators(decorator, defaultComplexityForField(typeFn));
};
