import { type OrderDirection } from "../enums";
import { type OrderFieldKey } from "./order-field.type";

export interface OrderInterface<T> {
  field: OrderFieldKey<T>;

  direction: OrderDirection;
}
