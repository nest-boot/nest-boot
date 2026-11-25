import { registerEnumType } from "@nest-boot/graphql";

/** Indicates whether a bounded count is exact or a lower bound. */
export enum CountPrecision {
  EXACT = "EXACT",
  AT_LEAST = "AT_LEAST",
}

registerEnumType(CountPrecision, { name: "CountPrecision" });
