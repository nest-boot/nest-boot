import { type Collection, type Ref } from "@mikro-orm/core";

type Loadable<T extends object> = Collection<T, any> | Ref<T>;

type ExtractType<T> = T extends Loadable<infer U> ? U : T;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

export type Field<T, D extends Prev[number] = 3> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? T[K] extends Date | any[]
          ? `${K}`
          : T[K] extends Ref<any> | Collection<any, any>
          ? Join<K, Field<ExtractType<T[K]>, Prev[D]>>
          : Join<K, Field<T[K], Prev[D]>>
        : never;
    }[keyof T]
  : "";

export interface SearchableOptions<T> {
  index?: string;
  filterableFields?: Array<Field<T>>;
  searchableFields?: Array<Field<T>>;
}
