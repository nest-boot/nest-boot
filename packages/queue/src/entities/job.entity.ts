/* eslint-disable @nest-boot/entity-property-config-from-types -- Match BullMQ-owned SQL types and formulas rather than infer a new schema from TypeScript. */
import { BigIntType, PrimaryKeyProp, raw, t } from "@mikro-orm/core";
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import type { JobProgress, JobsOptions, JobState } from "bullmq";

import { JobStatus } from "../enums/job-status.enum.js";

/**
 * Read-only mapping matching BullMQ's native table, including its operational indexes.
 * BullMQ owns job writes and bootstrap migrations; MikroORM manages indexes and RLS.
 */
@Entity({
  tableName: "job",
  schema: "bullmq",
  readonly: true,
  policies: [
    {
      name: "job_select_policy",
      command: "select",
      roles: ["authenticated"],
      using: `("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`,
    },
  ],
})
@Index({
  name: "job_ready_idx",
  properties: ["queue", "priority", "seq"],
  where: { state: "waiting" },
})
@Index({
  name: "job_delayed_idx",
  properties: ["queue", "processAtMs"],
  where: { state: "delayed" },
})
@Index({
  name: "job_active_idx",
  properties: ["queue", "lockedUntilMs"],
  where: { state: "active" },
})
@Index({
  name: "job_finished_idx",
  properties: ["queue", "state", "finishedAtMs"],
  where: { state: { $in: ["completed", "failed"] } },
})
@Index({
  name: "job_waiting_children_idx",
  properties: ["queue", "seq"],
  where: { state: "waiting-children" },
})
@Index({
  name: "job_parent_idx",
  properties: ["parentQueue", "parentId"],
  where: { parentId: { $ne: null } },
})
@Index({
  name: "job_scheduler_idx",
  properties: ["queue", "schedulerId"],
  where: { schedulerId: { $ne: null } },
})
@Index({
  name: "job_queue_user_idx",
  expression: (columns, table, indexName) =>
    raw("create index ?? on ?? (??, (??->>'userId'))", [
      indexName,
      table.qualifiedName,
      columns.queue,
      columns.data,
    ]),
})
@Index({
  name: "job_queue_workspace_idx",
  expression: (columns, table, indexName) =>
    raw("create index ?? on ?? (??, (??->>'workspaceId'))", [
      indexName,
      table.qualifiedName,
      columns.queue,
      columns.data,
    ]),
})
export class Job {
  [PrimaryKeyProp]?: ["queue", "jobId"];

  /** PostgreSQL queue name; this backend does not use Redis key prefixes. */
  @PrimaryKey({ type: t.text })
  queue!: string;

  /** Queue-local job identifier; the composite key is (queue, id). */
  @PrimaryKey({ type: t.text, fieldName: "id" })
  jobId!: string;

  /** Globally unique API identifier; BullMQ queue names cannot contain colons. */
  @Property({
    type: t.text,
    fieldName: "global_id",
    formula: (columns) => `${columns.queue} || ':' || ${columns.jobId}`,
  })
  id!: string;

  @Property({ type: new BigIntType("bigint") })
  seq!: bigint;

  @Property({ type: t.text })
  name!: string;

  @Enum({
    items: [
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "waiting-children",
    ],
    nativeEnumName: "job_state",
  })
  state!: Exclude<JobState, "prioritized" | "unknown">;

  /** API status, including priority waiting jobs. */
  @Property({
    type: t.text,
    formula: (columns) =>
      `case when ${columns.state} = 'waiting' and ${columns.priority} > 0 then 'prioritized' else ${columns.state}::text end`,
  })
  status!: JobStatus;

  @Property({ type: t.json, defaultRaw: "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Property({ type: t.json, defaultRaw: "'{}'::jsonb" })
  opts!: JobsOptions;

  @Property({ type: t.integer, default: 0 })
  priority!: number;

  @Property({
    type: new BigIntType("number"),
    fieldName: "delay_ms",
    defaultRaw: "0",
  })
  delayMs!: number;

  @Property({ type: t.integer, fieldName: "max_attempts", default: 1 })
  maxAttempts!: number;

  @Property({ type: t.integer, fieldName: "attempts_made", default: 0 })
  attemptsMade!: number;

  @Property({ type: t.integer, fieldName: "attempts_started", default: 0 })
  attemptsStarted!: number;

  @Property({ type: t.json, nullable: true })
  progress!: JobProgress | null;

  @Property({ type: t.json, fieldName: "return_value", nullable: true })
  returnValue!: unknown;

  @Property({ type: t.text, fieldName: "failed_reason", nullable: true })
  failedReason!: string | null;

  @Property({ type: t.json, nullable: true })
  stacktrace!: string[] | null;

  @Property({ type: t.text, fieldName: "deferred_failure", nullable: true })
  deferredFailure!: string | null;

  @Property({ type: t.text, fieldName: "processed_by", nullable: true })
  processedBy!: string | null;

  /** BullMQ stores timestamps as epoch milliseconds, not SQL timestamps. */
  @Property({ type: new BigIntType("number"), fieldName: "added_at_ms" })
  addedAtMs!: number;

  @Property({
    type: new BigIntType("number"),
    fieldName: "process_at_ms",
    nullable: true,
  })
  processAtMs!: number | null;

  @Property({
    type: new BigIntType("number"),
    fieldName: "processed_at_ms",
    nullable: true,
  })
  processedAtMs!: number | null;

  @Property({
    type: new BigIntType("number"),
    fieldName: "finished_at_ms",
    nullable: true,
  })
  finishedAtMs!: number | null;

  /** Creation time, converted from BullMQ epoch milliseconds. */
  @Property({
    type: t.datetime,
    formula: (columns) => `to_timestamp(${columns.addedAtMs} / 1000.0)`,
  })
  createdAt!: Date;

  /** Time processing started. */
  @Property({
    type: t.datetime,
    nullable: true,
    formula: (columns) => `to_timestamp(${columns.processedAtMs} / 1000.0)`,
  })
  startedAt!: Date | null;

  /** Time processing finished. */
  @Property({
    type: t.datetime,
    nullable: true,
    formula: (columns) => `to_timestamp(${columns.finishedAtMs} / 1000.0)`,
  })
  finishedAt!: Date | null;

  @Property({
    type: t.text,
    fieldName: "lock_token",
    nullable: true,
    hidden: true,
  })
  lockToken!: string | null;

  @Property({
    type: new BigIntType("number"),
    fieldName: "locked_until_ms",
    nullable: true,
  })
  lockedUntilMs!: number | null;

  @Property({ type: t.integer, fieldName: "stalled_count", default: 0 })
  stalledCount!: number;

  @Property({ type: t.text, fieldName: "dedup_id", nullable: true })
  dedupId!: string | null;

  @Property({ type: t.text, fieldName: "scheduler_id", nullable: true })
  schedulerId!: string | null;

  @Property({ type: t.text, fieldName: "parent_queue", nullable: true })
  parentQueue!: string | null;

  @Property({ type: t.text, fieldName: "parent_id", nullable: true })
  parentId!: string | null;

  @Property({ type: t.text, fieldName: "parent_key", nullable: true })
  parentKey!: string | null;

  @Property({ type: t.integer, fieldName: "pending_deps", default: 0 })
  pendingDeps!: number;

  @Property({ type: t.boolean, fieldName: "stalled_marked", default: false })
  stalledMarked!: boolean;
}
