import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from "@nest-boot/graphql";

import { Job } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";

registerEnumType(JobStatus, { name: "JobStatus" });

// Keep the ORM entity and GraphQL node constructor identical for ConnectionBuilder.
// Register only client-facing metadata; payloads and operational fields stay private.
ObjectType()(Job);
Field(() => ID)(Job.prototype, "id");
Field(() => String)(Job.prototype, "queue");
Field(() => String)(Job.prototype, "name");
Field(() => Float, { nullable: true })(Job.prototype, "progress");
Field(() => JobStatus)(Job.prototype, "status");
Field(() => Date, { nullable: true })(Job.prototype, "startedAt");
Field(() => Date, { nullable: true })(Job.prototype, "finishedAt");
Field(() => Date)(Job.prototype, "createdAt");
