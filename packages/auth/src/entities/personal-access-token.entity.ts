import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

import { User } from "./user.entity";

@Entity()
export class PersonalAccessToken {
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

  @PrimaryKey({ type: t.uuid })
  id: string = randomUUID();

  @Property({ nullable: true })
  name: string | null = null;

  @Property({ unique: true, length: 64 })
  token: string;

  @Property({ type: t.array })
  permissions: string[];

  @Property({ nullable: true })
  lastUsedAt: Date | null;

  @Property({ nullable: true })
  expiresAt: Date | null;

  @Property({ nullable: true })
  createdAt: Date | null;

  @Property({ nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User)
  user: Ref<User>;
}
