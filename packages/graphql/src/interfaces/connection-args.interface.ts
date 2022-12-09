import { OrderInterface } from "./order.interface";

export interface ConnectionArgsInterface<T, P extends keyof T> {
  query?: string;

  before?: string;

  after?: string;

  first?: number;

  last?: number;

  orderBy?: OrderInterface<T, P>;
}
