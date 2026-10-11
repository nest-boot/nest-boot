import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's event table. */
@Entity({ tableName: "event", schema: "bullmq", readonly: true })
export class QueueEvent {
  [PrimaryKeyProp]?: ["queue", "id"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  // MikroORM normalizes sequence defaults to null during introspection.
  // The independent event_seq sequence remains owned by BullMQ migrations.
  @PrimaryKey({
    type: new BigIntType("bigint"),
    autoincrement: true,
    defaultRaw: "nextval('bullmq.event_seq'::regclass)",
    ignoreSchemaChanges: ["default"],
  })
  id!: bigint;

  @Property({ type: t.text })
  event!: string;

  @Property({ type: t.json, defaultRaw: "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Property({ type: new BigIntType("bigint"), fieldName: "created_at_ms" })
  createdAtMs!: bigint;
}
