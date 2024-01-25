import type { FilterQuery } from "@mikro-orm/core";
import { AutoPath } from "@mikro-orm/core/typings";

import { ReplacementArgs } from "./replacement-args.interface";

export interface SearchSyntaxFieldOptions<
  Entity extends object,
  Fields extends string = never,
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> {
  field: string;
  type: Type;
  replacement?:
    | AutoPath<Entity, Fields>
    | ((args: ReplacementArgs<Type>) => FilterQuery<Entity>);
  array?: boolean;
  fulltext?: boolean;
  searchable?: boolean;
  filterable?: boolean;
}
