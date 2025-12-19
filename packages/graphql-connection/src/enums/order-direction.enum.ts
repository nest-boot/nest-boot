import { registerEnumType } from "@nest-boot/graphql";

/**
 * Specifies the direction for ordering query results.
 *
 * @example
 * ```typescript
 * const order = {
 *   field: "CREATED_AT",
 *   direction: OrderDirection.DESC,
 * };
 * ```
 */
export enum OrderDirection {
  /**
   * Ascending order (smallest to largest, A to Z, oldest to newest).
   */
  ASC = "ASC",

  /**
   * Descending order (largest to smallest, Z to A, newest to oldest).
   */
  DESC = "DESC",
}

registerEnumType(OrderDirection, { name: "OrderDirection" });
