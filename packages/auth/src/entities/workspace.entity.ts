import { BaseEntity, Collection, type Opt, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { workspaceScopePolicy } from "../policies/workspace-scope.policy.js";
import { Member } from "./member.entity.js";

/** Built-in Workspace entity with authentication persistence and access policies. */
@ObjectType()
@Entity({
  policies: [
    {
      command: "select",
      using: () => "true",
      roles: ["authenticated", "anonymous"],
    },
    workspaceScopePolicy({ property: "id", command: "update" }),
    workspaceScopePolicy({ property: "id", command: "delete" }),
  ],
})
@Index({ properties: ["createdAt"] })
export class Workspace extends BaseEntity {
  /** Primary key (Sonyflake ID, auto-generated). */
  @PrimaryKey({
    type: t.bigint,
  })
  @Field(() => ID)
  id: Opt<string> = Sonyflake.next().toString();

  /** Workspace display name. */
  @Property({ type: t.string })
  @Field(() => String)
  name!: string;

  /** Timestamp when the workspace was created. */
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

  /** Members of this workspace; reads retain the caller's RLS scope. */
  @OneToMany(() => Member, "workspace")
  @HideField()
  members: Collection<Member> = new Collection<Member>(this);
}
