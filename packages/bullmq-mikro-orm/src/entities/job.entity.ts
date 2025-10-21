import {
  Entity,
  Enum,
  Index,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { JobProgress } from "bullmq";

import { JobStatus } from "../enums/job-status.enum";

@Entity({ abstract: true })
export abstract class JobEntity {
  @PrimaryKey({ type: t.string })
  id!: string;

  @Property({ type: t.string })
  queueName!: string;

  @Index()
  @Property({ type: t.string })
  name!: string;

  @Property({ type: t.json })
  data!: any;

  @Property({ type: t.json, nullable: true })
  returnValue?: any;

  @Property({ type: t.string, nullable: true })
  failedReason?: string;

  @Property({ type: t.integer })
  priority!: number;

  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @Property({ type: t.json })
  progress!: Opt<JobProgress>;

  @Index()
  @Enum({ items: () => JobStatus })
  status!: string;

  @Property({ nullable: true })
  startedAt?: Date;

  @Property({ nullable: true })
  finishedAt?: Date;

  @Index()
  @Property({ defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  @Index()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
