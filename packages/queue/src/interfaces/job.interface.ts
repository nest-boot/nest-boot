import type {
  BulkJobOptions,
  Job as BullmqJob,
  JobSchedulerTemplateOptions,
  JobsOptions,
} from "bullmq";
import type { input } from "zod";

import type { JobSchema, JobSchemas } from "./job-schemas.interface.js";

/** Queue instance whose job contracts are inferred from its property. */
interface JobSchemaSource {
  readonly jobSchemas?: JobSchemas;
}

type Schemas<Q extends JobSchemaSource> = NonNullable<Q["jobSchemas"]>;
type Result<S extends JobSchema> = "result" extends keyof S
  ? input<NonNullable<S["result"]>>
  : ReturnType<() => void>;

/** Allowed job names inferred from a queue instance. */
export type JobName<Q extends JobSchemaSource> = Extract<
  keyof Schemas<Q>,
  string
>;

/** Discriminated Job union using the original data and result schema inputs. */
export type Job<
  Q extends JobSchemaSource,
  N extends JobName<Q> = JobName<Q>,
> = {
  [K in N]: BullmqJob<input<Schemas<Q>[K]["data"]>, Result<Schemas<Q>[K]>, K>;
}[N];

/** Correlated name/data tuples prevent mismatching union-typed arguments. */
export type QueueAddArgs<Q extends JobSchemaSource> = {
  [K in JobName<Q>]: [
    name: K,
    data: input<Schemas<Q>[K]["data"]>,
    opts?: JobsOptions,
  ];
}[JobName<Q>];

/** One entry of addBulk, keeping its name and data correlated. */
export type QueueBulkJob<Q extends JobSchemaSource> = {
  [K in JobName<Q>]: {
    name: K;
    data: input<Schemas<Q>[K]["data"]>;
    opts?: BulkJobOptions;
  };
}[JobName<Q>];

/** Typed queues supply an explicit name/data template; untyped queues retain BullMQ defaults. */
export type QueueSchedulerArgs<Q extends JobSchemaSource> =
  undefined extends Q["jobSchemas"]
    ? [
        jobTemplate?: {
          name?: string;
          data?: Record<string, unknown>;
          opts?: JobSchedulerTemplateOptions;
        },
      ]
    : [
        jobTemplate: {
          [K in JobName<Q>]: {
            name: K;
            data: input<Schemas<Q>[K]["data"]>;
            opts?: JobSchedulerTemplateOptions;
          };
        }[JobName<Q>],
      ];

/** Allowed handler return values, stored unchanged after validation. */
export type JobResult<
  Q extends JobSchemaSource,
  N extends JobName<Q> = JobName<Q>,
> = {
  [K in N]: Result<Schemas<Q>[K]>;
}[N];
