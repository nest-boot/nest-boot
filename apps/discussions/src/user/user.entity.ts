import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

import { UserPermission } from "./enums/permission.enum";

@ObjectType()
@Entity()
export class User {
  constructor(
    data: Pick<
      User,
      "id" | "name" | "email" | "avatar" | "password" | "invitationCode"
    > &
      Partial<Pick<User, "permissions" | "createdAt" | "updatedAt">>,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.avatar = data.avatar;
    this.password = data.password;
    this.invitationCode = data.invitationCode;

    data.permissions !== void 0 && (this.permissions = data.permissions);
    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
  }

  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
    onCreate: () => randomUUID(),
  })
  id: string;

  @Field()
  @Property()
  name: string;

  @Field()
  @Property({ unique: true })
  email: string;

  @Field({ nullable: true })
  @Property()
  avatar: string

  @Property({ type: "text" })
  password: string;

  @Field({ nullable: true })
  @Property({ type: "text" })
  invitationCode: string;

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
