import "reflect-metadata";

import assert from "node:assert/strict";

import { MikroORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import {
  QueueModule,
  type QueueModuleOptions,
  withQueueDatabaseConfig,
  JobService,
} from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { runMigrations } from "bullmq";

for (const dependency of [
  "@nest-boot/graphql",
  "@nest-boot/graphql-connection",
  "@nestjs/graphql",
]) {
  assert.throws(() => import.meta.resolve(dependency), {
    code: "ERR_MODULE_NOT_FOUND",
  });
}

const options: QueueModuleOptions = {};

@Module({
  imports: [
    QueueModule.forRoot(options),
    DatabaseModule.forRoot(
      withQueueDatabaseConfig({
        driver: PgliteDriver,
        dbName: "memory://",
      }),
    ),
  ],
})
class DatabaseQueueModule {}

const app = await NestFactory.createApplicationContext(DatabaseQueueModule, {
  logger: false,
  abortOnError: false,
});
try {
  assert(app.get(JobService) instanceof JobService);
  const orm = app.get(MikroORM);
  const client = await orm.em.getConnection().getNativeClient();
  await runMigrations({
    async query<R>(sql: string, params?: readonly unknown[]) {
      if (params?.length) return await client.query<R>(sql, [...params]);
      const results = await client.exec(sql);
      return { rows: (results.at(-1)?.rows ?? []) as R[] };
    },
  });
  await client.query(
    "insert into bullmq.job (queue, id, seq, name, state, added_at_ms) values ('email', '1', 1, 'send', 'waiting', 0)",
  );
  // No exposed providers: even an owner query cannot expose the stored job.
  const job = await RequestContext.run(
    new RequestContext({ type: "test" }),
    () => app.get(JobService).getJob("email:1"),
  );
  assert.equal(job, null);
  console.log("Packed queue discovers ORM queries without GraphQL peers");
} finally {
  await app.close();
}
