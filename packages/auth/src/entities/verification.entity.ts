import {
  BaseEntity,
  Entity,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

@Entity({ abstract: true })
export abstract class BaseVerification extends BaseEntity {
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  @Property({ type: t.text })
  identifier!: string;

  @Property({ type: t.text })
  value!: string;

  @Property({ type: t.datetime })
  expiresAt!: Date;

  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
