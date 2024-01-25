import { type OrderDirection } from "../enums";
import { OrderFieldKey } from "./order-field.type";

export interface OrderInterface<T> {
  field: OrderFieldKey<T>;

  direction: OrderDirection;
}
