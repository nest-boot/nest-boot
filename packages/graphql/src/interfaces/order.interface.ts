import { OrderDirection } from "../enums";

export interface OrderInterface<T, P extends keyof T> {
  field: P;

  direction: OrderDirection;
}
