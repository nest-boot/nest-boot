import { Column } from "@nest-boot/database";

import { HasPermissions } from "../interfaces/has-permission.interface";

export interface Type<T = any> extends Function {
  new (...args: any[]): T;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function mixinPermissions<T extends Type<{}>>(
  base: T
): Type<HasPermissions> & T {
  const trait = class extends base implements HasPermissions {
    permissions: string[];
  };

  Column({ type: "simple-array", generator: () => [] })(
    trait.prototype,
    "permissions"
  );

  return trait;
}
