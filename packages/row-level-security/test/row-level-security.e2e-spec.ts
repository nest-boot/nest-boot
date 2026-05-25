import "dotenv/config";
import "reflect-metadata";

import {
  Entity,
  EntityManager,
  Knex,
  knex,
  MikroORM,
  PostgreSqlDriver,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/postgresql";
import { RequestContext } from "@nest-boot/request-context";

import {
  createPolicyBootstrapSqlStatements,
  createPolicyUpSqlStatements,
  PolicyCommand,
  quoteQualifiedIdentifier,
  RowLevelSecurityContext,
  RowLevelSecurityEntityManager,
} from "../src";
import { setRowLevelSecurityOptions } from "../src/utils/set-row-level-security-options";

@Entity()
class RowLevelSecurityTestEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.string })
  name!: string;
}

describe("RowLevelSecurity - database integration", () => {
  let db: Knex;
  let orm: MikroORM;

  beforeAll(async () => {
    const connection = getDatabaseUrl();

    db = knex({
      client: "pg",
      connection,
    });

    orm = await MikroORM.init({
      allowGlobalContext: true,
      clientUrl: connection,
      driver: PostgreSqlDriver,
      entities: [RowLevelSecurityTestEntity],
    });

    await runStatements(createPolicyBootstrapSqlStatements());
  }, 30000);

  afterAll(async () => {
    await orm?.close(true);
    await db?.destroy();
  });

  afterEach(() => {
    setRowLevelSecurityOptions();
  });

  it("installs app.get_context and converts transaction-local values", async () => {
    const row = await db.transaction(async (trx) => {
      await trx.raw("select set_config('app.user_id', '42', true)");

      const result = await trx.raw<{
        rows: { user_id: number; missing_id: number | null }[];
      }>(
        "select app.get_context('user_id', null::integer) as user_id, app.get_context('missing_id', null::integer) as missing_id",
      );

      return result.rows[0];
    });

    expect(row).toEqual({
      missing_id: null,
      user_id: 42,
    });
  });

  it("enforces generated row level security policies with app context", async () => {
    const tableName = createTestTableName();
    const tableIdentifier = quoteQualifiedIdentifier("public", tableName);

    await createPolicyFixture(tableName);

    try {
      const rows = await db.transaction(async (trx) => {
        await trx.raw("set local role authenticated");
        await trx.raw("select set_config('app.tenant_id', '1', true)");

        const result = await trx.raw<{
          rows: { id: number; tenant_id: number; content: string }[];
        }>(`select id, tenant_id, content from ${tableIdentifier} order by id`);

        return result.rows;
      });

      expect(rows).toEqual([
        {
          content: "tenant-1",
          id: 1,
          tenant_id: 1,
        },
      ]);

      await expect(
        db.transaction(async (trx) => {
          await trx.raw("set local role authenticated");
          await trx.raw("select set_config('app.tenant_id', '1', true)");
          await trx.raw(
            `insert into ${tableIdentifier} (id, tenant_id, content) values (3, 2, 'blocked')`,
          );
        }),
      ).rejects.toThrow(/row-level security policy/i);
    } finally {
      await db.raw(`drop table if exists ${tableIdentifier}`);
    }
  });

  it("applies RowLevelSecurityContext inside real MikroORM transactions", async () => {
    const row = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurityContext.setRole("authenticated");
        RowLevelSecurityContext.set("tenant_id", 7);

        return await transactionalWithRowLevelSecurity(async (em) => {
          const trx = em.getTransactionContext<Knex>();

          if (!trx) {
            throw new Error("Transaction context is not available.");
          }

          const result = await trx.raw<{
            rows: { current_user: string; tenant_id: number }[];
          }>(
            "select current_user, app.get_context('tenant_id', null::integer) as tenant_id",
          );

          return result.rows[0];
        });
      },
    );

    expect(row).toEqual({
      current_user: "authenticated",
      tenant_id: 7,
    });
  });

  async function createPolicyFixture(tableName: string) {
    const tableIdentifier = quoteQualifiedIdentifier("public", tableName);

    await db.raw(`drop table if exists ${tableIdentifier}`);
    await db.raw(`
      create table ${tableIdentifier} (
        id integer primary key,
        tenant_id integer not null,
        content text not null
      )
    `);
    await db.raw(`grant all on table ${tableIdentifier} to authenticated`);
    await db.raw(
      `insert into ${tableIdentifier} (id, tenant_id, content) values (1, 1, 'tenant-1'), (2, 2, 'tenant-2')`,
    );

    await runStatements(
      createPolicyUpSqlStatements({
        schemaName: "public",
        tableName,
        policyName: `${tableName}_tenant_policy`,
        command: PolicyCommand.ALL,
        roles: ["authenticated"],
        using:
          "((select app.get_context('tenant_id', null::integer)) = tenant_id)",
        withCheck:
          "((select app.get_context('tenant_id', null::integer)) = tenant_id)",
      }),
    );
  }

  async function runStatements(statements: string[]) {
    for (const statement of statements) {
      await db.raw(statement);
    }
  }

  async function transactionalWithRowLevelSecurity<T>(
    callback: (em: EntityManager) => T | Promise<T>,
  ) {
    const transactional = Reflect.get(
      RowLevelSecurityEntityManager.prototype,
      "transactional",
    ) as (
      this: EntityManager,
      cb: (em: EntityManager) => T | Promise<T>,
    ) => Promise<T>;

    return await transactional.call(orm.em, callback);
  }
});

function getDatabaseUrl() {
  const databaseUrl = process.env.DB_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DB_URL or DATABASE_URL is required to run row-level-security database integration tests.",
    );
  }

  return databaseUrl;
}

function createTestTableName() {
  return `rls_e2e_documents_${String(process.pid)}_${String(Date.now())}`;
}
