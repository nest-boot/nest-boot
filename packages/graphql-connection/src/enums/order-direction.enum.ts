import { registerEnumType } from "@nest-boot/graphql";

export enum OrderDirection {
  ASC = "ASC",
  DESC = "DESC",
}

registerEnumType(OrderDirection, { name: "OrderDirection" });
