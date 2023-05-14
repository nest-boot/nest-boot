import { type OrderInterface } from "./order.interface";

export interface ConnectionArgsInterface<T> {
  query?: string;

  before?: string;

  after?: string;

  first?: number;

  last?: number;

  orderBy?: OrderInterface<T>;
}
