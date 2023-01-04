import { Collection, Reference } from "@mikro-orm/core";

type Loadable<T extends object> =
  | Collection<T, any>
  | Reference<T>
  | readonly T[];

type ExtractType<T> = T extends Loadable<infer U> ? U : T;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

type Field<T, D extends Prev[number] = 3> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? T[K] extends Date
          ? `${K}`
          : T[K] extends Reference<any> | Collection<any, any>
          ? Join<K, Field<ExtractType<T[K]>, Prev[D]>>
          : Join<K, Field<T[K], Prev[D]>>
        : never;
    }[keyof T]
  : "";

export interface SearchableOptions<T> {
  index: string;
  filterableAttributes?: Array<Field<T>>;
  searchableAttributes?: Array<Field<T>>;
  sortableAttributes?: Array<Field<T>>;
}
