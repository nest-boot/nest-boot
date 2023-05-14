import { type OrderDirection } from "../enums";
import { type OrderFieldValue } from "./order-field.type";

export interface OrderInterface<T> {
  field: OrderFieldValue<T>;

  direction: OrderDirection;
}
