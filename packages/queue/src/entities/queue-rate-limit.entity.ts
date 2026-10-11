import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's rate_limit table. */
@Entity({ tableName: "rate_limit", schema: "bullmq", readonly: true })
export class QueueRateLimit {
  [PrimaryKeyProp]?: "queue";

  @PrimaryKey({ type: t.text })
  queue!: string;

  @Property({ type: new BigIntType("bigint"), defaultRaw: "0" })
  points!: bigint;

  @Property({ type: new BigIntType("bigint"), fieldName: "expire_at_ms" })
  expireAtMs!: bigint;
}
