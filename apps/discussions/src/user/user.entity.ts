import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

import { UserPermission } from "./enums/permission.enum";

@ObjectType()
@Entity()
export class User {
  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
    onCreate: () => randomUUID(),
  })
  id!: string;

  @Field()
  @Property()
  name!: string;

  @Field()
  @Property({ unique: true })
  email!: string;

  @Field({ nullable: true })
  @Property()
  avatar?: string;

  @Property({ type: "text" })
  password?: string;

  @Field({ nullable: true })
  @Property({ type: "text" })
  invitationCode?: string;

  @Field(() => [UserPermission])
  @Property({ type: "array", defaultRaw: "array[]::varchar[]" })
  permissions: UserPermission[] = [];

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
