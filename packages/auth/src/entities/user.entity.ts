import {
  Collection,
  Entity,
  OneToMany,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";

import { PersonalAccessToken } from "./personal-access-token.entity";

@Entity()
export class User {
  constructor(
    data: Pick<User, "id" | "name" | "email" | "password"> &
      Partial<
        Pick<
          User,
          "permissions" | "createdAt" | "updatedAt" | "personalAccessTokens"
        >
      >,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;

    data.permissions !== void 0 && (this.permissions = data.permissions);
    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
    data.personalAccessTokens !== void 0 &&
      (this.personalAccessTokens = data.personalAccessTokens);
  }

  @PrimaryKey()
  id: string;

  @Property({ type: t.string })
  name!: string;

  @Property({ type: t.string, unique: true })
  email!: string;

  @Property({ type: t.string })
  password!: string;

  @Property({ type: t.array, default: "{}" })
  permissions: Opt<string[]> = [];

  @Property()
  createdAt: Opt<Date> = new Date();

  @Property()
  updatedAt: Opt<Date> = new Date();

  @OneToMany(
    () => PersonalAccessToken,
    (personalAccessToken) => personalAccessToken.user,
  )
  personalAccessTokens = new Collection<PersonalAccessToken>(this);
}
