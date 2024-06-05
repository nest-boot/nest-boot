import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";

import { JobStatus } from "../enums";

@Entity()
export class Job {
  constructor(
    data: Pick<Job, "id" | "name" | "queueName" | "data" | "result"> &
      Partial<
        Pick<
          Job,
          | "failedReason"
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
    this.result = data.result;

    data.failedReason !== void 0 && (this.failedReason = data.failedReason);
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

  @Property({ type: t.json })
  result: any;

  @Property({ type: t.float, default: 0 })
  progress = 0;

  @Property({ default: JobStatus.PENDING })
  status: JobStatus = JobStatus.PENDING;

  @Property({ type: t.text, nullable: true })
  failedReason: string | null = null;

  @Property({ nullable: true })
  startedAt: Date | null = null;

  @Property({ nullable: true })
  settledAt: Date | null = null;

  @Property()
  createdAt: Date = new Date();

  @Property()
  updatedAt: Date = new Date();
}
