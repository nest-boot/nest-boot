import { PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's meta table. */
@Entity({ tableName: "meta", schema: "bullmq", readonly: true })
export class QueueMeta {
  [PrimaryKeyProp]?: ["queue", "field"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  @PrimaryKey({ type: t.text })
  field!: string;

  @Property({ type: t.text, nullable: true })
  value!: string | null;
}
