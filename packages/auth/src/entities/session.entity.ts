import {
  BaseEntity,
  Cascade,
  Entity,
  ManyToOne,
  Opt,
  PrimaryKey,
  Property,
  t,
  Unique,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

@Entity({ abstract: true })
export abstract class BaseSession extends BaseEntity {
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  @Property({ type: t.text })
  @Unique()
  token!: string;

  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  @Property({ type: t.datetime })
  expiresAt!: Date;

  @Property({ type: t.text, nullable: true })
  ipAddress?: Opt<string>;

  @Property({ type: t.text, nullable: true })
  userAgent?: Opt<string>;

  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
