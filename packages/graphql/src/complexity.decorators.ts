import {
  type ComplexityEstimator,
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
import type { GraphQLScalarType } from "graphql";

import type { FieldComplexityEstimatorArgs } from "./field-complexity-estimator-args.js";

type ResolvedValue<T> = T extends readonly (infer Item)[]
  ? (ResolvedValue<Item> | null | undefined)[]
  : T extends StringConstructor
    ? string
    : T extends NumberConstructor
      ? number
      : T extends BooleanConstructor
        ? boolean
        : T extends GraphQLScalarType<infer Internal, unknown>
          ? Internal
          : T extends abstract new (...args: any[]) => infer Instance
            ? Instance
            : unknown;

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
export type MutationOptions<T = any, Result = unknown> = WithComplexity<
  NestMutationOptions<T>,
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
    options: FieldOptions<ResolvedValue<T>>,
  ): PropertyDecorator & MethodDecorator;
  <T extends ReturnTypeFuncValue>(
    typeFunc?: ReturnTypeFunc<T>,
    options?: FieldOptions<
      ResolvedValue<NoInfer<T>>,
      ResolvedValue<NoInfer<T>>
    >,
  ): PropertyDecorator & MethodDecorator;
}

export const Query: RootResolverDecorator<NestQueryOptions> = NestQuery;
export const Mutation: RootResolverDecorator<NestMutationOptions> =
  NestMutation;
export const ResolveField: ResolveFieldDecorator = NestResolveField;
export const Field: FieldDecorator = NestField;
