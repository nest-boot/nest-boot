import {
  BaseEntity,
  Cascade,
  Entity,
  ManyToOne,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

@Entity({ abstract: true })
export abstract class BaseAccount extends BaseEntity {
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  @Property({ type: t.text })
  accountId!: string;

  @Property({ type: t.text })
  providerId!: string;

  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  @Property({ type: t.text, nullable: true })
  accessToken?: Opt<string>;

  @Property({ type: t.text, nullable: true })
  refreshToken?: Opt<string>;

  @Property({ type: t.text, nullable: true })
  idToken?: Opt<string>;

  @Property({ type: t.datetime, nullable: true })
  accessTokenExpiresAt?: Opt<Date>;

  @Property({ type: t.datetime, nullable: true })
  refreshTokenExpiresAt?: Opt<Date>;

  @Property({ type: t.text, nullable: true })
  scope?: Opt<string>;

  @Property({ type: t.text, nullable: true })
  password?: Opt<string>;

  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
