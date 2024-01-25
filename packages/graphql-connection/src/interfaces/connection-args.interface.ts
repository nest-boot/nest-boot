import type { FindByCursorOptions } from "@mikro-orm/core/drivers";

import { OrderInterface } from "./order.interface";

export interface ConnectionArgsInterface<
  Entity extends object,
  Hint extends string = never,
  Fields extends string = "*",
  Excludes extends string = never,
> extends Pick<
    FindByCursorOptions<Entity, Hint, Fields, Excludes>,
    "before" | "after" | "first" | "last"
  > {
  query?: string;

  orderBy?: OrderInterface<Entity>;
}
