import { type OrderDirection } from "../enums/index.js";
import { OrderFieldKey } from "./order-field.type.js";

/**
 * Specifies the ordering for a connection query.
 *
 * @typeParam T - The entity type being ordered
 *
 * @example
 * ```typescript
 * const order: OrderInterface<User> = {
 *   field: "CREATED_AT",
 *   direction: OrderDirection.DESC,
 * };
 * ```
 */
export interface OrderInterface<T> {
  /**
   * The field to order by (uppercase with underscores, e.g., "CREATED_AT").
   */
  field: OrderFieldKey<T>;

  /**
   * The direction to order (ASC or DESC).
   */
  direction: OrderDirection;
}
