import { BaseEntity, Cascade, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { randomUUID } from "crypto";

import type { BaseUser } from "./user.entity.js";

/**
 * Abstract base entity for user session records.
 *
 * @remarks
 * Maps to the better-auth `session` model. Each session is tied to a
 * `BaseUser` and identified by a unique token.
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

  /** Foreign key referencing the owning `BaseUser`. */
  @Index()
  @ManyToOne({
    entity: () => "User" as any,
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

  /** Administrator that created this impersonation session. */
  @ManyToOne({
    entity: () => "User" as any,
    fieldName: "impersonated_by_id",
    nullable: true,
    deleteRule: "set null",
  })
  impersonatedBy?: Ref<BaseUser> | null;

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
