import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";

import { PersonalAccessToken } from "./personal-access-token.entity";

@Entity()
export class User {
  constructor(
    data: Pick<User, "id" | "name" | "email"> &
      Partial<
        Pick<
          User,
          | "password"
          | "permissions"
          | "createdAt"
          | "updatedAt"
          | "personalAccessTokens"
        >
      >,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;

    data.password !== void 0 && (this.password = data.password);
    data.permissions !== void 0 && (this.permissions = data.permissions);
    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
    data.personalAccessTokens !== void 0 &&
      (this.personalAccessTokens = data.personalAccessTokens);
  }

  @PrimaryKey()
  id: string;

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @Property({ nullable: true })
  password: string | null = null;

  @Property({ type: t.array, default: "{}" })
  permissions: string[] = [];

  @Property()
  createdAt: Date = new Date();

  @Property()
  updatedAt: Date = new Date();

  @OneToMany(
    () => PersonalAccessToken,
    (personalAccessToken) => personalAccessToken.user,
  )
  personalAccessTokens = new Collection<PersonalAccessToken>(this);
}
