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

/**
 * Abstract entity representing a session.
 */
@Entity({ abstract: true })
export class BaseSession extends BaseEntity {
  /**
   * Unique identifier for the session.
   */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /**
   * Session token.
   */
  @Property({ type: t.text })
  @Unique()
  token!: string;

  /**
   * User ID associated with the session.
   */
  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  /**
   * Session expiration date.
   */
  @Property({ type: t.datetime })
  expiresAt!: Date;

  /**
   * IP address of the client.
   */
  @Property({ type: t.text, nullable: true })
  ipAddress?: Opt<string>;

  /**
   * User agent of the client.
   */
  @Property({ type: t.text, nullable: true })
  userAgent?: Opt<string>;

  /**
   * Creation date.
   */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /**
   * Last update date.
   */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
