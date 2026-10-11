import { type Opt, t } from "@mikro-orm/core";
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import { type JobProgress } from "bullmq";

import { JobStatus } from "../enums/job-status.enum.js";

/** Persisted BullMQ job history. Add this entity to MikroORM discovery. */
@Entity()
export class Job {
  /** BullMQ job identifier. */
  @PrimaryKey({ type: t.string })
  id!: string;

  /** Name of the BullMQ queue this job belongs to. */
  @Property({ type: t.string })
  queueName!: string;

  /** Job name (type identifier). */
  @Index()
  @Property({ type: t.string })
  name!: string;

  /** JSON payload of the job. */
  @Property({ type: t.json })
  data!: any;

  /** Return value from the job processor, if completed. */
  @Property({ type: t.json, nullable: true })
  returnValue?: any;

  /** Error message if the job failed. */
  @Property({ type: t.string, nullable: true })
  failedReason?: string;

  /** Job priority (lower values = higher priority). */
  @Property({ type: t.integer })
  priority!: number;

  /** Current progress of the job (number or object). */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @Property({ type: t.json })
  progress!: Opt<JobProgress>;

  /** Current status of the job. */
  @Index()
  @Enum({ items: () => JobStatus })
  status!: JobStatus;

  /** Timestamp when the job started processing. */
  @Property({ type: t.datetime, nullable: true })
  startedAt?: Date;

  /** Timestamp when the job finished processing. */
  @Property({ type: t.datetime, nullable: true })
  finishedAt?: Date;

  /** Timestamp when the job was created. */
  @Index()
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Index()
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
