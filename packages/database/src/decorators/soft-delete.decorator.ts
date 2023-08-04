import { type EntityClass, Filter } from "@mikro-orm/core";

export function SoftDelete<E extends { deletedAt: Date | null }>() {
  return (target: EntityClass<E>) => {
    Filter({
      name: "softDelete",
      cond: { deletedAt: { $eq: null } },
      default: true,
    })(target);
  };
}
