import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";

/** Read-only mapping of BullMQ's scheduler table. */
@Entity({ tableName: "scheduler", schema: "bullmq", readonly: true })
@Index({ name: "scheduler_next_idx", properties: ["queue", "nextRunMs"] })
export class QueueScheduler {
  [PrimaryKeyProp]?: ["queue", "schedulerId"];

  @PrimaryKey({ type: t.text })
  queue!: string;

  @PrimaryKey({ type: t.text, fieldName: "scheduler_id" })
  schedulerId!: string;

  @Property({ type: t.text, nullable: true })
  name!: string | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "next_run_ms",
    nullable: true,
  })
  nextRunMs!: bigint | null;

  @Property({ type: t.text, nullable: true })
  pattern!: string | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "every_ms",
    nullable: true,
  })
  everyMs!: bigint | null;

  @Property({ type: t.text, nullable: true })
  tz!: string | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "start_date_ms",
    nullable: true,
  })
  startDateMs!: bigint | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "end_date_ms",
    nullable: true,
  })
  endDateMs!: bigint | null;

  @Property({ type: t.integer, fieldName: "limit_count", nullable: true })
  limitCount!: number | null;

  @Property({ type: t.integer, fieldName: "iteration_count", default: 0 })
  iterationCount!: number;

  @Property({ type: t.json, fieldName: "template_data", nullable: true })
  templateData!: unknown;

  @Property({ type: t.json, fieldName: "template_opts", nullable: true })
  templateOpts!: Record<string, unknown> | null;

  @Property({ type: t.text, fieldName: "producer_id", nullable: true })
  producerId!: string | null;

  @Property({
    type: new BigIntType("bigint"),
    fieldName: "offset_ms",
    nullable: true,
  })
  offsetMs!: bigint | null;
}
