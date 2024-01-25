import { AutoPath } from "@mikro-orm/core/typings";

type DotToUnderscore<S extends string> =
  S extends `${infer Prefix}.${infer Rest}`
    ? `${Prefix}_${DotToUnderscore<Rest>}`
    : S;

export type OrderFieldKey<T> = Uppercase<DotToUnderscore<AutoPath<T, string>>>;

export type OrderFieldValue<T> = AutoPath<T, string>;

export type OrderFieldType<T> = {
  [key in OrderFieldKey<T>]: OrderFieldValue<T>;
};
