import { OrderInterface } from "./order.interface";

export interface ConnectionArgsInterface<Entity extends object> {
  after?: string;

  before?: string;

  first?: number;

  last?: number;

  query?: string;

  orderBy?: OrderInterface<Entity>;
}
