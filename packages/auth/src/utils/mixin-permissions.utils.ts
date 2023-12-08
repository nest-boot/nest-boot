import { Property, t } from "@mikro-orm/core";

import { type HasPermissions } from "../interfaces";

export type Type<T = any> = new (...args: any[]) => T;

export function mixinPermissions<T extends Type>(
  base: T,
): Type<HasPermissions> & T {
  const trait = class extends base implements HasPermissions {
    permissions: string[] = [];
  };

  Property({ type: t.array, onCreate: () => [] })(
    trait.prototype,
    "permissions",
  );

  return trait;
}
