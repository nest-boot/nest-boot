import { FilterQuery } from "@mikro-orm/core";

import { OrderInterface } from "./order.interface";

export interface ConnectionArgsInterface<Entity extends object> {
  after?: string;

  before?: string;

  first?: number;

  last?: number;

  query?: string;

  filter?: FilterQuery<Entity>;

  orderBy?: OrderInterface<Entity>;
}
