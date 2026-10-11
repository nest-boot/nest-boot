/* eslint-disable @nest-boot/entity-property-config-from-types -- Match BullMQ-owned SQL types and formulas rather than infer a new schema from TypeScript. */
import { BigIntType, PrimaryKeyProp, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { JobProgress, JobsOptions, JobState } from "bullmq";

import { JobStatus } from "../enums/job-status.enum.js";

/**
 * Query mapping for the BullMQ-owned table; BullMQ performs all mutations.
 * `readonly` disables flush change tracking, not native SQL or schema changes.
 * The ORM configuration must also exclude the BullMQ schema from migrations.
 */
@Entity({ tableName: "job", schema: "*", readonly: true })
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

  @Property({ type: t.text })
  state!: Exclude<JobState, "prioritized" | "unknown">;

  /** API status, including priority waiting jobs. */
  @Property({
    type: t.text,
    formula: (columns) =>
      `case when ${columns.state} = 'waiting' and ${columns.priority} > 0 then 'prioritized' else ${columns.state}::text end`,
  })
  status!: JobStatus;

  @Property({ type: t.json })
  data!: Record<string, unknown>;

  @Property({ type: t.json })
  opts!: JobsOptions;

  @Property({ type: t.integer })
  priority!: number;

  @Property({ type: new BigIntType("number"), fieldName: "delay_ms" })
  delayMs!: number;

  @Property({ type: t.integer, fieldName: "max_attempts" })
  maxAttempts!: number;

  @Property({ type: t.integer, fieldName: "attempts_made" })
  attemptsMade!: number;

  @Property({ type: t.integer, fieldName: "attempts_started" })
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

  @Property({ type: t.integer, fieldName: "stalled_count" })
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

  @Property({ type: t.integer, fieldName: "pending_deps" })
  pendingDeps!: number;

  @Property({ type: t.boolean, fieldName: "stalled_marked" })
  stalledMarked!: boolean;
}
