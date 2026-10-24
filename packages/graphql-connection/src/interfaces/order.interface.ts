import { type OrderDirection } from "../enums/index.js";
import { OrderFieldValue } from "./order-field.type.js";

/**
 * Specifies the ordering for a connection query.
 * @template T - The entity type being ordered
 * @example
 * ```typescript
 * const order: OrderInterface<User> = {
 *   field: "createdAt",
 *   direction: OrderDirection.DESC,
 * };
 * ```
 */
export interface OrderInterface<T> {
  /**
   * The entity field path to order by after GraphQL enum coercion, e.g., "createdAt".
   */
  field: OrderFieldValue<T>;

  /**
   * The direction to order (ASC or DESC).
   */
  direction: OrderDirection;
}
