/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Trigger,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { SystemAccountPermission } from "../enums/system-account-permission.enum.js";
import { apiKeyCleanupTrigger } from "../infrastructure/api-key-triggers.js";
import { User } from "./user.entity.js";

/** Platform identity owned independently of the administrator that created it. */
@ObjectType()
@Trigger(apiKeyCleanupTrigger("system_account", "public"))
@Entity({
  tableName: "system_account",
  policies: [
    {
      command: "all",
      roles: ["anonymous", "authenticated"],
      using: "false",
      check: "false",
    },
  ],
})
@Index({ properties: ["createdAt"] })
export class SystemAccount extends BaseEntity {
  /** Stable identity identifier. */
  @PrimaryKey({ type: t.bigint })
  @Field(() => ID)
  id: Opt<string> = Sonyflake.next().toString();

  /** Name of the integration or background system. */
  @Property({ type: t.string })
  @Field(() => String)
  name!: string;

  /** Disabling the account invalidates all its credentials. */
  @Property({ type: t.boolean, default: true })
  @Field(() => Boolean)
  enabled: Opt<boolean> = true;

  /** Explicit maximum grants for credentials owned by this account. */
  @Property({ type: t.array, defaultRaw: "'{}'" })
  @Field(() => [SystemAccountPermission])
  permissions: Opt<string[]> = [];

  /** Audit reference; deleting the creator leaves the system identity intact. */
  @ManyToOne(() => User, { ref: true, nullable: true, deleteRule: "set null" })
  @HideField()
  createdBy?: Opt<Ref<User>> | null = null;

  /**
   * Identifier of the administrator recorded for audit.
   * @returns Creator identifier, or null when it is unavailable.
   */
  @Field(() => ID, { nullable: true })
  get createdById(): Opt<string> | null {
    return this.createdBy?.id ?? null;
  }

  /** Creation timestamp. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  @Field(() => Date)
  createdAt: Opt<Date> = new Date();

  /** Last modification timestamp. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  @Field(() => Date)
  updatedAt: Opt<Date> = new Date();
}
