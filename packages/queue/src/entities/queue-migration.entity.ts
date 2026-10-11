import { PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's migration table. */
@Entity({ tableName: "migration", schema: "bullmq", readonly: true })
export class QueueMigration {
  [PrimaryKeyProp]?: "version";

  @PrimaryKey({ type: t.integer, autoincrement: false })
  version!: number;

  @Property({ type: t.text })
  name!: string;

  @Property({ type: t.integer, fieldName: "min_client_version" })
  minClientVersion!: number;

  @Property({
    type: t.datetime,
    columnType: "timestamptz",
    fieldName: "applied_at",
    defaultRaw: "now()",
  })
  appliedAt!: Date;
}
