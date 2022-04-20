/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnyEntity } from "@mikro-orm/core";
import { Column } from "typeorm";

export interface Type<T = any> extends Function {
  new (...args: any[]): T;
}

export interface MixinTenantEntity<T extends { id: number | string }>
  extends AnyEntity {
  tenantId: T["id"];
}

export function mixinTenantId<T extends { id: number | string }>(
  Base: Type<AnyEntity>
): Type<MixinTenantEntity<T>> {
  class TenantTrait extends Base implements MixinTenantEntity<T> {
    @Column({
      type: "bigint",
      default: () => "current_tenant_id()",
    })
    tenantId: T["id"];
  }

  return TenantTrait;
}
