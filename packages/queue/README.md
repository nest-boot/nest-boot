# @nest-boot/queue

Redis queues and singleton processors for Nest, built on BullMQ. Queue state and
processing require Redis only. Database records and authenticated GraphQL queries
are provided separately by [`@nest-boot/queue-api`](../queue-api/README.md).

## Usage

Set `REDIS_URL`, import `QueueModule` and register queue and processor providers:

```ts
import {
  BaseProcessor,
  BaseQueue,
  type Job,
  Processor,
  Queue,
  QueueModule,
} from "@nest-boot/queue";
import { Module } from "@nestjs/common";
import { z } from "zod";

@Queue()
class EmailQueue extends BaseQueue {
  readonly jobSchemas = {
    send: { data: z.object({ to: z.email() }) },
  };
}

@Processor(EmailQueue)
class EmailProcessor extends BaseProcessor {
  async processSend(job: Job<EmailQueue, "send">): Promise<void> {
    console.log(job.data.to);
  }
}

@Module({
  imports: [QueueModule],
  providers: [EmailQueue, EmailProcessor],
})
export class EmailModule {}
```

`@Queue()` removes the trailing `Queue` and converts the class name to kebab-case;
`EmailQueue` becomes `email`. Use `@Queue("name")` to choose a static name. Pass
Redis connection settings and default job options to `super(options)`. Explicit
`connection` options override `REDIS_URL`. Worker settings belong in the
Processor constructor, for example `super({ concurrency: 5 })`.

Keep providers singleton and queue names unique. Export and reuse the same queue
provider across modules. Each handler gets an independent `RequestContext`; do
not store current-job state on the singleton Processor.

## Job contracts

`readonly jobSchemas` determines allowed names, data and results. Each job needs
an object data schema; an omitted result schema means `void`. Implement one
`processXXX` method per job: `send` maps to `processSend`, and `send-email` maps to
`processSendEmail`. The decorator checks every required method's exact Job
parameter and Promise result. Colliding handler names are rejected. Unknown jobs
and missing handlers fail without automatic retries.

Submission, processing and completion validate with Zod `parseAsync()`. Parsed
results are discarded: stored values, handler parameters and results use the
original schema inputs (`z.input`). Defaults, transforms, coercions and field
stripping do not replace payloads. Keep schema callbacks free of side effects and
perform business conversions explicitly. Native BullMQ `updateData()` remains
unchanged; updated data is validated before the next processing attempt.

## Consumers and events

Workers start explicitly. Configure a CLI with `CommandModule`, then run:

```bash
nb queue:start
nb queue:start --queue email
```

Without filters, all registered consumers start. Filters apply uniformly,
including queue-api's `job` consumer; select it explicitly when filtering if the
same process should persist history. Unknown queue names or a CLI selection with
no consumers fail before Workers start. Applications can also inject
`QueueManager` and call `start(queueNames?)` after initialization.

Every registered queue has a native QueueEvents reader, including producer-only
applications. Readers listen for new events using BullMQ's default starting
position, without startup replay. Use the read-only `queue.queueEvents` getter
after application initialization and `processor.worker` after Worker startup.
The framework creates and closes these transports. Import native classes from
`bullmq` when needed.

## Health checks

Import `HealthCheckModule` to register a check for each discovered queue. Provider
aliases share one check. Keys use `queue.<name>`, for example `queue.email`.
Checks use the existing connection, require readiness and read pause state within
1000 ms. A paused queue is healthy with `paused: true`; connection errors, closing
queues and timeouts report `down`. Repeated probes share a pending read for the
same queue. Checks do not measure Worker availability or job throughput.

Without HealthCheckModule, no checks or health endpoint are added. The exported
QueueHealthIndicator also supports explicit `check(key, queue, timeout)` calls.

See the [queue tutorial](https://github.com/nest-boot/nest-boot/blob/main/apps/docs/content/docs/tutorial/queue.mdx)
for configuration, request context and typed API examples.
