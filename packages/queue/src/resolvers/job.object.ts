import {
  Field,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from "@nest-boot/graphql";
import { GraphQLJSON } from "graphql-type-json";

import { Job } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";

registerEnumType(JobStatus, { name: "JobStatus" });

// Keep the ORM entity and GraphQL node constructor identical for ConnectionBuilder.
ObjectType()(Job);
Field(() => ID)(Job.prototype, "id");
Field(() => ID)(Job.prototype, "jobId");
Field(() => String)(Job.prototype, "queue");
Field(() => String)(Job.prototype, "name");
Field(() => GraphQLJSON)(Job.prototype, "data");
Field(() => GraphQLJSON, { nullable: true })(Job.prototype, "returnValue");
Field(() => String, { nullable: true })(Job.prototype, "failedReason");
Field(() => Int)(Job.prototype, "priority");
Field(() => GraphQLJSON, { nullable: true })(Job.prototype, "progress");
Field(() => JobStatus)(Job.prototype, "status");
Field(() => Date, { nullable: true })(Job.prototype, "startedAt");
Field(() => Date, { nullable: true })(Job.prototype, "finishedAt");
Field(() => Date)(Job.prototype, "createdAt");
