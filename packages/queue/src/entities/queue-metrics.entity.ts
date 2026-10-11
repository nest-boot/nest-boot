import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's metrics table. */
@Entity({ tableName: "metrics", schema: "bullmq", readonly: true })
export class QueueMetrics {
  [PrimaryKeyProp]?: ["queue", "kind"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  @PrimaryKey({ type: t.text })
  kind!: string;

  @Property({ type: new BigIntType("bigint"), defaultRaw: "0" })
  count!: bigint;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "prev_ts",
    nullable: true,
  })
  prevTs!: bigint | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "prev_count",
    defaultRaw: "0",
  })
  prevCount!: bigint;

  @Property({
    type: t.array,
    defaultRaw: "'{}'::bigint[]",
    columnType: "bigint[]",
  })
  data!: string[];
}
