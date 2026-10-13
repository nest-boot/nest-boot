import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";

import { Job } from "./job.entity.js";

/** Read-only mapping of BullMQ's job_log table. */
@Entity({ tableName: "job_log", schema: "bullmq", readonly: true })
export class JobLog {
  [PrimaryKeyProp]?: ["job", "idx"];

  @ManyToOne(() => Job, {
    fieldNames: ["queue", "job_id"],
    primary: true,
    mapToPk: true,
    deleteRule: "cascade",
    updateRule: "no action",
    foreignKeyName: "job_log_queue_job_id_fkey",
  })
  job!: [string, string];

  @PrimaryKey({ type: new BigIntType("bigint"), autoincrement: false })
  idx!: bigint;

  @Property({ type: t.text })
  row!: string;
}
