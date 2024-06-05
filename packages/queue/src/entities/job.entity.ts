import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";

import { JobStatus } from "../enums/job-status.enum";

@Entity()
export class Job {
  constructor(
    data: Pick<Job, "id" | "name" | "queueName" | "data"> &
      Partial<
        Pick<
          Job,
          | "progress"
          | "status"
          | "startedAt"
          | "settledAt"
          | "createdAt"
          | "updatedAt"
        >
      >,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.queueName = data.queueName;
    this.data = data.data;

    data.progress !== void 0 && (this.progress = data.progress);
    data.status !== void 0 && (this.status = data.status);
    data.startedAt !== void 0 && (this.startedAt = data.startedAt);
    data.settledAt !== void 0 && (this.settledAt = data.settledAt);
    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
  }

  @PrimaryKey()
  id: string;

  @Property()
  name: string;

  @Property()
  queueName: string;

  @Property({ type: t.json })
  data: any;

  @Property({ type: t.float, default: 0 })
  progress = 0;

  @Property({ default: JobStatus.PENDING })
  status: JobStatus = JobStatus.PENDING;

  @Property()
  startedAt: Date | null = null;

  @Property()
  settledAt: Date | null = null;

  @Property()
  createdAt: Date = new Date();

  @Property()
  updatedAt: Date = new Date();
}
