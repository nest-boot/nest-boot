import { type Field } from "@nest-boot/search";

type DotToUnderscore<S extends string> =
  S extends `${infer Prefix}.${infer Rest}`
    ? `${Prefix}_${DotToUnderscore<Rest>}`
    : S;

export type OrderFieldKey<T> = Uppercase<DotToUnderscore<Field<T>>>;

export type OrderFieldValue<T> = Field<T>;

export type OrderFieldType<T> = {
  [key in OrderFieldKey<T>]: OrderFieldValue<T>;
};
