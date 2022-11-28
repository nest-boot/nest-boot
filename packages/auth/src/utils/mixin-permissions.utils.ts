import { Property, t } from "@mikro-orm/core";

import { HasPermissions } from "../interfaces/has-permission.interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Type<T = any> = new (...args: any[]) => T;

// eslint-disable-next-line @typescript-eslint/ban-types
export function mixinPermissions<T extends Type<{}>>(
  base: T
): Type<HasPermissions> & T {
  const trait = class extends base implements HasPermissions {
    permissions: string[] = [];
  };

  Property({ type: t.json, onCreate: () => [] })(
    trait.prototype,
    "permissions"
  );

  return trait;
}
