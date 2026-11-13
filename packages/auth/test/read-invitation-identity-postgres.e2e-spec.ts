import { randomUUID } from "node:crypto";

import { EntityManager, EntitySchema, MikroORM } from "@mikro-orm/core";
import { getDatabaseConfig } from "@nest-boot/database";
import { RequestContext } from "@nest-boot/request-context";

import { readInvitationIdentity } from "../src/workspace/utils/read-invitation-identity.util.js";

/** The lookup contract must also hold on PostgreSQL with a single available connection. */
describe.runIf(/^postgres(?:ql)?:/i.test(process.env.DATABASE_URL ?? ""))(
  "invitation identity lookup on PostgreSQL",
  () => {
    const suffix = randomUUID().replaceAll("-", "");
    const schema = `nb_auth_lookup_${suffix}`;
    const role = `nb_lookup_${suffix}`;
    const table = `"${schema}".lookup_record`;
    let orm: MikroORM;
    beforeAll(async () => {
      const options = await getDatabaseConfig();
      orm = await MikroORM.init({
        ...options,
        schema,
        entitiesTs: [],
        preferTs: false,
        pool: { min: 0, max: 1 },
        driverOptions: {
          ...options.driverOptions,
          connectionTimeoutMillis: 1000,
        },
        entities: [
          new EntitySchema({
            name: "InvitationLookupProbe",
            properties: { id: { type: "number", primary: true } },
          }),
        ],
        context: () =>
          RequestContext.isActive()
            ? RequestContext.get(EntityManager)
            : undefined,
      });
      const connection = orm.em.getConnection();
      await connection.execute(`create role "${role}" nologin noinherit`);
      await connection.execute(`create schema "${schema}"`);
      await connection.execute(
        `create table ${table} (id integer primary key, workspace text not null)`,
      );
      await connection.execute(
        `insert into ${table} values (1, 'one'), (2, 'two')`,
      );
      await connection.execute(
        `alter table ${table} enable row level security`,
      );
      await connection.execute(
        `create policy lookup_workspace on ${table} to "${role}" using (workspace = current_setting('app.auth.workspace.id', true))`,
      );
      await connection.execute(
        `grant usage on schema "${schema}" to "${role}"`,
      );
      await connection.execute(`grant select on ${table} to "${role}"`);
    });
    afterAll(async () => {
      if (!orm) {
        return;
      }
      try {
        await orm.em
          .getConnection()
          .execute(`drop schema if exists "${schema}" cascade`);
        await orm.em.getConnection().execute(`drop role if exists "${role}"`);
      } finally {
        await orm.close(true);
      }
    });
    it.each([false, true])(
      "restores the caller role and reuses its physical connection (failure=%s)",
      async (failure) => {
        const em = orm.em.fork({
          session: { role, variables: { "app.auth.workspace.id": "one" } },
        });
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            RequestContext.set(EntityManager, em);
            await em.transactional(async (transaction) => {
              const connection = transaction.getConnection();
              const ctx = transaction.getTransactionContext();
              const before = await connection.execute(
                "select current_user as role, pg_backend_pid() as pid",
                [],
                "all",
                ctx,
              );
              expect(before[0].role).toBe(role);
              expect(
                await connection.execute(
                  `select id from ${table} where id = 2`,
                  [],
                  "all",
                  ctx,
                ),
              ).toEqual([]);
              const lookup = readInvitationIdentity(
                transaction,
                async (reader) => {
                  const readerConnection = reader.getConnection();
                  const readerContext = reader.getTransactionContext();
                  if (failure) {
                    await readerConnection.execute(
                      "select 1 / 0",
                      [],
                      "all",
                      readerContext,
                    );
                  }
                  return await readerConnection.execute(
                    `select id, pg_backend_pid() as pid from ${table} where id = 2`,
                    [],
                    "all",
                    readerContext,
                  );
                },
              );
              if (failure) {
                await expect(lookup).rejects.toThrow();
              } else {
                expect(await lookup).toEqual([{ id: 2, pid: before[0].pid }]);
              }
              expect(
                await connection.execute(
                  "select current_user as role, pg_backend_pid() as pid",
                  [],
                  "all",
                  ctx,
                ),
              ).toEqual(before);
              expect(
                await connection.execute(
                  `select id from ${table} where id = 2`,
                  [],
                  "all",
                  ctx,
                ),
              ).toEqual([]);
            });
          },
        );
      },
    );
  },
);
