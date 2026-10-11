import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's dedup table. */
@Entity({ tableName: "dedup", schema: "bullmq", readonly: true })
@Index({
  name: "dedup_expire_idx",
  properties: ["queue", "expireAtMs"],
  where: { expireAtMs: { $ne: null } },
})
export class QueueDedup {
  [PrimaryKeyProp]?: ["queue", "dedupId"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  @PrimaryKey({ type: t.text, fieldName: "dedup_id" })
  dedupId!: string;

  @Property({ type: t.text, fieldName: "job_id" })
  jobId!: string;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "expire_at_ms",
    nullable: true,
  })
  expireAtMs!: bigint | null;
}
