/* eslint-disable @nest-boot/graphql-field-config-from-types -- Persist arbitrary progress but expose only numeric values via the resolver. */
/* eslint-disable @nest-boot/entity-property-config-from-types -- History uses explicit SQL UUID, JSON and bigint types. */
import { BigIntType, t } from "@mikro-orm/core";
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, Float, HideField, ID, ObjectType } from "@nest-boot/graphql";
import type { JobProgress } from "bullmq";

import { JobStatus } from "../enums/job-status.enum.js";

/** Database history synchronized from Redis QueueEvents by the Job worker. */
@ObjectType()
@Entity()
@Unique({ properties: ["queue", "jobId"] })
@Index({
  columns: [{ name: "data.userId" }, { name: "createdAt" }, { name: "id" }],
})
@Index({
  columns: [
    { name: "data.workspaceId" },
    { name: "createdAt" },
    { name: "id" },
  ],
})
@Index({
  properties: ["createdAt", "id"],
  where: `"data"->>'userId' is null and "data"->>'workspaceId' is null`,
})
export class Job {
  /** Database-generated UUID, stable across synchronization events. */
  @PrimaryKey({ type: t.uuid, defaultRaw: "gen_random_uuid()" })
  @Field(() => ID)
  id!: string;

  /** Queue name of the source Redis job. */
  @Property({ type: t.text })
  @Field(() => String)
  queue!: string;

  /** Original BullMQ identifier, unique within its queue. */
  @Property({ type: t.text })
  @HideField()
  jobId!: string;

  @Property({ type: t.text })
  @Field(() => String)
  name!: string;

  @Property({ type: t.json, defaultRaw: "'{}'::jsonb" })
  @HideField()
  data!: Record<string, unknown>;

  @Enum({ items: () => JobStatus })
  @Field(() => JobStatus)
  status!: JobStatus;

  @Property({ type: t.json, nullable: true })
  @Field(() => Float, { nullable: true })
  progress!: JobProgress | null;

  @Property({ type: t.json, nullable: true })
  @HideField()
  returnValue!: unknown;

  @Property({ type: t.text, nullable: true })
  @HideField()
  failedReason!: string | null;

  @Property({ type: t.datetime })
  @Field(() => Date)
  createdAt!: Date;

  @Property({ type: t.datetime, nullable: true })
  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Property({ type: t.datetime, nullable: true })
  @Field(() => Date, { nullable: true })
  finishedAt!: Date | null;

  /** Millisecond component of the latest applied Redis Stream ID. */
  @Property({ type: new BigIntType("bigint"), default: 0 })
  @HideField()
  lastEventMs!: bigint;

  /** Sequence component of the latest applied Redis Stream ID. */
  @Property({ type: new BigIntType("bigint"), default: 0 })
  @HideField()
  lastEventSeq!: bigint;
}
