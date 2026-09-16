/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { randomUUID } from "crypto";

import { userManagementPredicate } from "../policies/user-management.policy.js";
import { User } from "./user.entity.js";

/** Built-in Session entity with authentication persistence and access policies. */
@Entity({
  policies: [
    {
      name: "session_select_policy",
      command: "select",
      roles: ["authenticated"],
      using: ({ user }) =>
        `"${user}" = nullif(current_setting('app.user.id', true), '')::bigint or ${userManagementPredicate(["session:list"])}`,
    },
  ],
})
@ObjectType()
export class Session extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  @Field(() => ID)
  id: Opt<string> = randomUUID();

  /** Unique session token used for authentication. */
  @Property({ type: t.text })
  @Unique()
  token!: string;

  /** User that owns this record. */
  @Index()
  @ManyToOne(() => User, {
    fieldName: "user_id",
    ref: true,
    deleteRule: "cascade",
  })
  @HideField()
  user!: Ref<User>;

  /** Timestamp when the session expires. */
  @Property({ type: t.datetime })
  @Field(() => Date)
  expiresAt!: Date;

  /** IP address of the client that created or last used this session. */
  @Property({ type: t.text, nullable: true })
  @Field(() => String, { nullable: true })
  ipAddress?: string | null;

  /** User-Agent header from the client that created or last used this session. */
  @Property({ type: t.text, nullable: true })
  @Field(() => String, { nullable: true })
  userAgent?: string | null;

  /** Administrator that created this impersonation session. */
  @ManyToOne(() => User, {
    fieldName: "impersonated_by_id",
    nullable: true,
    deleteRule: "cascade",
  })
  impersonatedBy?: Ref<User> | null;

  /** Timestamp when the session was created. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
  })
  @Field(() => Date)
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  @Field(() => Date)
  updatedAt: Opt<Date> = new Date();
}
