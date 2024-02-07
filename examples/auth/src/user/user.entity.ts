/* eslint-disable @nest-boot/entity-property-no-optional-or-non-null-assertion */

import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { User as BaseUser } from "@nest-boot/auth";
import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { randomUUID } from "crypto";

import { PersonalAccessToken } from "../personal-access-token/personal-access-token.entity";

@ObjectType()
@Entity()
export class User extends BaseUser {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    data: Pick<User, "id" | "name" | "email" | "permissions"> &
      Partial<
        Pick<
          User,
          "password" | "createdAt" | "updatedAt" | "personalAccessTokens"
        >
      >,
  ) {
    super(data);
  }

  @Field(() => ID)
  @PrimaryKey({ type: t.uuid })
  id: string = randomUUID();

  @Field()
  @Property()
  name!: string;

  @Field()
  @Property({ unique: true })
  email!: string;

  @Field(() => [String])
  @Property({ type: t.array })
  permissions!: string[];

  @Field()
  @Property()
  createdAt: Date = new Date();

  @Field()
  @Property()
  updatedAt: Date = new Date();

  @OneToMany(
    () => PersonalAccessToken,
    (personalAccessToken) => personalAccessToken.user,
  )
  personalAccessTokens = new Collection<PersonalAccessToken>(this);
}
