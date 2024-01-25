/* eslint-disable @nest-boot/entity-property-no-optional-or-non-null-assertion */

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
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
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
  }

  @Field(() => ID)
  @PrimaryKey({ type: t.uuid })
  id: string = randomUUID();

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  name: string | null = null;

  @Field()
  @Property({ unique: true, length: 64 })
  token!: string;

  @Field(() => [String])
  @Property({ type: t.array })
  permissions!: string[];

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  expiresAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  createdAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  updatedAt!: Date | null;

  @ManyToOne(() => User)
  user!: Ref<User>;
}
