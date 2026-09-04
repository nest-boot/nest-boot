import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/**
 * Abstract base entity for workspace records.
 *
 * @remarks
 * Provides the fields required by the built-in workspace and API-key services.
 * Applications may extend this entity with product-specific fields and indexes.
 */
@Entity({ abstract: true })
export class BaseWorkspace extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Workspace display name. */
  @Property({ type: t.text })
  name!: string;

  /** Timestamp when the workspace was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** Soft-deletion timestamp; `null` means the workspace is active. */
  @Property({ type: t.datetime, nullable: true })
  deletedAt?: Opt<Date> | null = null;
}
