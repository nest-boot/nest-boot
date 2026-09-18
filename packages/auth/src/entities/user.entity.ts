import { BaseEntity, Collection, type Opt, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { UserPermission } from "../enums/user-permission.enum.js";
import { UserRole } from "../enums/user-role.enum.js";
import {
  userDeletePredicate,
  userUpdatePredicate,
} from "../policies/user-management.policy.js";
import { Member } from "./member.entity.js";

/** Built-in User entity with authentication persistence and access policies. */
@ObjectType()
@Entity({
  policies: [
    {
      command: "select",
      // Services enforce profile visibility, including custom Ability rules.
      using: "true",
      roles: ["authenticated"],
    },
    {
      command: "update",
      roles: ["authenticated"],
      using: () => userUpdatePredicate,
      check: () => userUpdatePredicate,
    },
    {
      command: "delete",
      roles: ["authenticated"],
      using: () => userDeletePredicate,
    },
  ],
})
@Index({ properties: ["createdAt"] })
export class User extends BaseEntity {
  /** Primary key (Sonyflake ID, auto-generated). */
  @PrimaryKey({
    type: t.bigint,
  })
  @Field(() => ID)
  id: Opt<string> = Sonyflake.next().toString();

  /** Display name of the user. */
  @Property({ type: t.string })
  @Field(() => String)
  name!: string;

  /** Unique email address of the user. */
  @Property({ type: t.string })
  @Unique()
  @Field(() => String)
  email!: string;

  /** Whether the email address has been verified. */
  @Property({
    type: t.boolean,
  })
  @Field(() => Boolean)
  emailVerified!: boolean;

  /** URL of the user's avatar image. */
  @Property({
    type: t.string,
    nullable: true,
  })
  @Field(() => String, { nullable: true })
  image?: Opt<string>;

  /** Application roles used to resolve user-administration permissions. */
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types -- Dynamic enums preserve the stored string array type.
  @Property({ type: t.array })
  @Field(() => [UserRole])
  roles: Opt<string[]> = ["user"];

  /** User-administration and session permissions granted to this identity. */
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types -- Dynamic enums preserve the stored string array type.
  @Property({ type: t.array })
  @Field(() => [UserPermission])
  permissions: Opt<string[]> = [];

  /** Whether the user is currently banned from authenticating. */
  @Property({
    type: t.boolean,
  })
  @Field(() => Boolean)
  banned: Opt<boolean> = false;

  /** Administrative reason for the current ban. */
  @Property({
    type: t.string,
    nullable: true,
  })
  @Field(() => String, { nullable: true })
  banReason?: Opt<string> | null = null;

  /** Time when the current ban expires; `null` means it is permanent. */
  @Property({ type: t.datetime, nullable: true })
  @Field(() => Date, { nullable: true })
  banExpiresAt?: Opt<Date> | null = null;

  /** Timestamp when the user was created. */
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

  /** Memberships owned by this user; reads retain the caller's RLS scope. */
  @OneToMany(() => Member, "user")
  @HideField()
  members: Collection<Member> = new Collection<Member>(this);
}
