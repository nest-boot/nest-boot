import { Filter } from "@mikro-orm/core";

export const SoftDelete = Filter({
  name: "softDelete",
  cond: { deletedAt: { $eq: null } },
  default: true,
});
