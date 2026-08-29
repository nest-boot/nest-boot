import { registerEnumType } from "@nest-boot/graphql";

/**
 * Describes whether a connection's total count is exact or a lower bound.
 */
export enum TotalCountRelation {
  /**
   * The total count is exact.
   */
  EQ = "EQ",

  /**
   * The total count is a lower bound.
   */
  GTE = "GTE",
}

registerEnumType(TotalCountRelation, { name: "TotalCountRelation" });
