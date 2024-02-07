import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/core";
import { PersonalAccessToken as BasePersonalAccessToken } from "@nest-boot/auth";
import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { randomUUID } from "crypto";

import { User } from "../user/user.entity";

@ObjectType()
@Entity()
export class PersonalAccessToken extends BasePersonalAccessToken {
  constructor(
    data: Pick<
      PersonalAccessToken,
      | "token"
      | "permissions"
      | "lastUsedAt"
      | "expiresAt"
      | "createdAt"
      | "updatedAt"
      | "user"
    > &
      Partial<Pick<PersonalAccessToken, "id" | "name">>,
  ) {
    super(data);

    this.token = data.token;
    this.permissions = data.permissions;
    this.lastUsedAt = data.lastUsedAt;
    this.expiresAt = data.expiresAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.user = data.user;

    data.id !== void 0 && (this.id = data.id);
    data.name !== void 0 && (this.name = data.name);
  }

  @Field(() => ID)
  @PrimaryKey({ type: t.uuid })
  id: string = randomUUID();

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  name: string | null = null;

  @Field()
  @Property({ unique: true, length: 64 })
  token: string;

  @Field(() => [String])
  @Property({ type: t.array })
  permissions: string[];

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  lastUsedAt: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  expiresAt: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User)
  user: Ref<User>;
}
