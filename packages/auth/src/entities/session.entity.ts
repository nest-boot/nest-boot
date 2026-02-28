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
 * Abstract base entity for user session records.
 *
 * @remarks
 * Maps to the better-auth `session` model. Each session is tied to a
 * {@link BaseUser} and identified by a unique token.
 */
@Entity({ abstract: true })
export class BaseSession extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Unique session token used for authentication. */
  @Property({ type: t.text })
  @Unique()
  token!: string;

  /** Foreign key referencing the owning {@link BaseUser}. */
  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  /** Timestamp when the session expires. */
  @Property({ type: t.datetime })
  expiresAt!: Date;

  /** IP address of the client that created or last used this session. */
  @Property({ type: t.text, nullable: true })
  ipAddress?: Opt<string>;

  /** User-Agent header from the client that created or last used this session. */
  @Property({ type: t.text, nullable: true })
  userAgent?: Opt<string>;

  /** Timestamp when the session was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
