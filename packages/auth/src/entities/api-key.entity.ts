import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";

import type { BaseUser } from "./user.entity.js";
import type { BaseWorkspace } from "./workspace.entity.js";

/**
 * Abstract base entity for user- or workspace-owned API keys.
 *
 * @remarks
 * Stores only the key hash. The plaintext key is returned once when it is
 * created and must not be persisted by the application.
 */
@Entity({ abstract: true })
export class BaseApiKey extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** API-key display name. */
  @Property({ type: t.text })
  name!: string;

  /** Starting characters retained for recognition in user interfaces. */
  @Property({ type: t.text, nullable: true })
  start?: Opt<string> | null = null;

  /** Public prefix embedded in the plaintext key. */
  @Property({ type: t.text, nullable: true })
  prefix?: Opt<string> | null = null;

  /** SHA-256 hash of the complete plaintext API key. */
  @Property({ type: t.text })
  @Unique()
  key!: string;

  /** Whether the key can authenticate requests. */
  @Property({ type: t.boolean, default: true })
  enabled: Opt<boolean> = true;

  /** Operations that this API key may perform. */
  @Property({ type: t.array })
  permissions: Opt<string[]> = [];

  /** Timestamp when the key was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** Last successful usage timestamp. */
  @Property({ type: t.datetime, nullable: true })
  lastUsedAt?: Opt<Date> | null = null;

  /** Expiration timestamp; `null` means the key does not expire. */
  @Property({ type: t.datetime, nullable: true })
  expiresAt?: Opt<Date> | null = null;

  /** User or workspace that owns the key. */
  @ManyToOne({ entity: () => ["User", "Workspace"] as any })
  owner!: Ref<BaseUser | BaseWorkspace>;
}
