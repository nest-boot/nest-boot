import {
  BaseEntity,
  Entity,
  Opt,
  PrimaryKey,
  Property,
  t,
  Unique,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

@Entity({ abstract: true })
export class BaseUser extends BaseEntity {
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  @Property({ type: t.text })
  name!: string;

  @Property({ type: t.text })
  @Unique()
  email!: string;

  @Property({ type: t.boolean, default: false })
  emailVerified!: boolean;

  @Property({ type: t.text, nullable: true })
  image?: Opt<string>;

  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
