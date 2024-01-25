import { EntityManager } from "@mikro-orm/core";

import { type ComparatorOperator } from "../enums";

export interface ReplacementArgs<
  Type extends "string" | "number" | "bigint" | "boolean" | "date" = never,
> {
  entityManager: EntityManager;
  type: Type;
  field: string;
  operator: ComparatorOperator;
  value:
    | (Type extends "string"
        ? string
        : Type extends "number"
          ? number
          : Type extends "bigint"
            ? bigint
            : Type extends "boolean"
              ? boolean
              : Date)
    | (Type extends "string"
        ? string
        : Type extends "number"
          ? number
          : Type extends "bigint"
            ? bigint
            : Type extends "boolean"
              ? boolean
              : Date)[];
}
