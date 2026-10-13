import { PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's dedup_next table. */
@Entity({ tableName: "dedup_next", schema: "bullmq", readonly: true })
export class QueueDedupNext {
  [PrimaryKeyProp]?: ["queue", "dedupId"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  @PrimaryKey({ type: t.text, fieldName: "dedup_id" })
  dedupId!: string;

  @Property({ type: t.json })
  payload!: Record<string, unknown>;
}
