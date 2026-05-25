import "dotenv/config";
import "reflect-metadata";

import { EntityManager as CoreEntityManager, MikroORM } from "@mikro-orm/core";
import {
  Entity,
  EntityManager,
  Knex,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/postgresql";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { RequestContext } from "@nest-boot/request-context";
import { Test, TestingModule } from "@nestjs/testing";

import {
  createPolicyBootstrapSqlStatements,
  createPolicyUpSqlStatements,
  PolicyCommand,
  quoteIdentifier,
  quoteQualifiedIdentifier,
  RowLevelSecurityContext,
  RowLevelSecurityEntityManager,
} from "../src";
import { setRowLevelSecurityOptions } from "../src/utils/set-row-level-security-options";

const DOCUMENT_SCHEMA_NAME = `rls_e2e_${String(process.pid)}_${String(
  Date.now(),
)}`;
const DOCUMENT_TABLE_NAME = "documents";

@Entity({ schema: DOCUMENT_SCHEMA_NAME, tableName: DOCUMENT_TABLE_NAME })
class RowLevelSecurityDocumentEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "tenant_id", type: t.integer })
  tenantId!: number;

  @Property({ type: t.string })
  content!: string;
}

describe("RowLevelSecurity - database integration", () => {
  let orm: MikroORM;
  let testingModule: TestingModule;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({
          allowGlobalContext: true,
          autoLoadEntities: true,
          metadataCache: {
            enabled: false,
          },
        }),
        MikroOrmModule.forFeature([RowLevelSecurityDocumentEntity]),
      ],
    }).compile();

    await testingModule.init();

    orm = testingModule.get(MikroORM);

    await resetSchema();
    await runStatements(createPolicyBootstrapSqlStatements());
  }, 30000);

  afterAll(async () => {
    try {
      await dropSchema();
    } finally {
      await testingModule?.close();
    }
  });

  beforeEach(() => {
    setRowLevelSecurityOptions();
  });

  afterEach(() => {
    setRowLevelSecurityOptions();
  });

  it("installs app.get_context and converts transaction-local values", async () => {
    const row = await withKnexTransaction(async (trx) => {
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
    const tableIdentifier = quoteQualifiedIdentifier(
      DOCUMENT_SCHEMA_NAME,
      DOCUMENT_TABLE_NAME,
    );

    await createPolicyFixture();

    const rows = await withKnexTransaction(async (trx) => {
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
      withKnexTransaction(async (trx) => {
        await trx.raw("set local role authenticated");
        await trx.raw("select set_config('app.tenant_id', '1', true)");
        await trx.raw(
          `insert into ${tableIdentifier} (id, tenant_id, content) values (3, 2, 'blocked')`,
        );
      }),
    ).rejects.toThrow(/row-level security policy/i);
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

  async function resetSchema() {
    await dropSchema();
    await orm.schema.createSchema({ schema: DOCUMENT_SCHEMA_NAME });
  }

  async function dropSchema() {
    if (!orm) {
      return;
    }

    await orm.schema.dropSchema({
      dropDb: false,
      dropMigrationsTable: false,
      schema: DOCUMENT_SCHEMA_NAME,
    });
  }

  async function createPolicyFixture() {
    const tableIdentifier = quoteQualifiedIdentifier(
      DOCUMENT_SCHEMA_NAME,
      DOCUMENT_TABLE_NAME,
    );

    await execute(
      `grant usage on schema ${quoteIdentifier(DOCUMENT_SCHEMA_NAME)} to authenticated`,
    );
    await execute(`grant all on table ${tableIdentifier} to authenticated`);
    await orm.em.fork().insertMany(RowLevelSecurityDocumentEntity, [
      {
        content: "tenant-1",
        id: 1,
        tenantId: 1,
      },
      {
        content: "tenant-2",
        id: 2,
        tenantId: 2,
      },
    ]);

    await runStatements(
      createPolicyUpSqlStatements({
        schemaName: DOCUMENT_SCHEMA_NAME,
        tableName: DOCUMENT_TABLE_NAME,
        policyName: `${DOCUMENT_TABLE_NAME}_tenant_policy`,
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
      await execute(statement);
    }
  }

  async function execute(sql: string) {
    await orm.em.getConnection().execute(sql);
  }

  async function withKnexTransaction<T>(
    callback: (trx: Knex) => T | Promise<T>,
  ) {
    return await orm.em.transactional(async (em) => {
      const trx = em.getTransactionContext<Knex>();

      if (!trx) {
        throw new Error("Transaction context is not available.");
      }

      return await callback(trx);
    });
  }

  async function transactionalWithRowLevelSecurity<T>(
    callback: (em: EntityManager) => T | Promise<T>,
  ) {
    const entityManager = RequestContext.get(CoreEntityManager) ?? orm.em;
    const transactional = Reflect.get(
      RowLevelSecurityEntityManager.prototype,
      "transactional",
    ) as (
      this: EntityManager,
      cb: (em: EntityManager) => T | Promise<T>,
    ) => Promise<T>;

    return await transactional.call(entityManager as EntityManager, callback);
  }
});
