import "dotenv/config";
import "reflect-metadata";

import { MikroORM } from "@mikro-orm/core";
import {
  Entity,
  Knex,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/postgresql";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { RequestContext } from "@nest-boot/request-context";
import { Test, TestingModule } from "@nestjs/testing";

import {
  createPolicyBootstrapSqlStatements,
  createPolicyRoleUpSqlStatements,
  createPolicyUpSqlStatements,
  PolicyCommand,
  quoteIdentifier,
  quoteQualifiedIdentifier,
  RowLevelSecurity,
  RowLevelSecurityDriver,
  RowLevelSecurityMode,
} from "../src";

const DOCUMENT_SCHEMA_NAME = `rls_e2e_${String(process.pid)}_${String(
  Date.now(),
)}`;
const DOCUMENT_TABLE_NAME = "documents";
const MEMBER_TABLE_NAME = "members";

@Entity({ schema: DOCUMENT_SCHEMA_NAME, tableName: MEMBER_TABLE_NAME })
class RowLevelSecurityMemberEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "tenant_id", type: t.integer })
  tenantId!: number;

  @Property({ type: t.string })
  name!: string;
}

@Entity({ schema: DOCUMENT_SCHEMA_NAME, tableName: DOCUMENT_TABLE_NAME })
class RowLevelSecurityDocumentEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "tenant_id", type: t.integer })
  tenantId!: number;

  @Property({ type: t.string })
  content!: string;

  @ManyToOne(() => RowLevelSecurityMemberEntity, {
    fieldName: "member_id",
    ref: true,
  })
  member!: Ref<RowLevelSecurityMemberEntity>;
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
          driver: RowLevelSecurityDriver,
          metadataCache: {
            enabled: false,
          },
        }),
        MikroOrmModule.forFeature([
          RowLevelSecurityDocumentEntity,
          RowLevelSecurityMemberEntity,
        ]),
      ],
    }).compile();

    await testingModule.init();

    orm = testingModule.get(MikroORM);

    await resetSchema();
    await runStatements(createPolicyBootstrapSqlStatements());
    await runStatements(createPolicyRoleUpSqlStatements(["authenticated"]));
  }, 30000);

  afterAll(async () => {
    try {
      await dropSchema();
    } finally {
      await testingModule?.close();
    }
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

  it("applies RowLevelSecurity inside real MikroORM transactions", async () => {
    const row = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");
        RowLevelSecurity.setContext("tenant_id", 7);

        return await orm.em.transactional(async (em) => {
          const trx = em.getTransactionContext<Knex>();

          if (!trx) {
            throw new Error("Transaction context is not available.");
          }

          return await em.getConnection().execute<{
            current_user: string;
            tenant_id: number;
          }>("select current_user, app.get_context('tenant_id', null::integer) as tenant_id", [], "get", trx);
        });
      },
    );

    expect(row).toEqual({
      current_user: "authenticated",
      tenant_id: 7,
    });
  });

  it("clears row level security state when disabled inside an existing transaction", async () => {
    const result = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");
        RowLevelSecurity.setContext("tenant_id", 7);

        return await orm.em.transactional(async (em) => {
          const trx = em.getTransactionContext<Knex>();

          if (!trx) {
            throw new Error("Transaction context is not available.");
          }

          const scoped = await em.getConnection().execute<{
            current_user: string;
            tenant_id: number;
          }>("select current_user, app.get_context('tenant_id', null::integer) as tenant_id", [], "get", trx);

          RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);

          const disabled = await em.getConnection().execute<{
            current_user: string;
            tenant_id: number | null;
          }>("select current_user, app.get_context('tenant_id', null::integer) as tenant_id", [], "get", trx);

          return {
            disabled,
            scoped,
          };
        });
      },
    );

    expect(result.scoped).toEqual({
      current_user: "authenticated",
      tenant_id: 7,
    });
    expect(result.disabled.current_user).not.toBe("authenticated");
    expect(result.disabled.tenant_id).toBeNull();
  });

  it("clears row level security state without RequestContext inside an existing transaction", async () => {
    const result = await orm.em.transactional(async (em) => {
      const trx = em.getTransactionContext<Knex>();

      if (!trx) {
        throw new Error("Transaction context is not available.");
      }

      const scoped = await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RowLevelSecurity.setRole("authenticated");
          RowLevelSecurity.setContext("tenant_id", 7);

          return await em.getConnection().execute<{
            current_user: string;
            tenant_id: number;
          }>("select current_user, app.get_context('tenant_id', null::integer) as tenant_id", [], "get", trx);
        },
      );

      const unscoped = await em.getConnection().execute<{
        current_user: string;
        tenant_id: number | null;
      }>("select current_user, app.get_context('tenant_id', null::integer) as tenant_id", [], "get", trx);

      return {
        scoped,
        unscoped,
      };
    });

    expect(result.scoped).toEqual({
      current_user: "authenticated",
      tenant_id: 7,
    });
    expect(result.unscoped.current_user).not.toBe("authenticated");
    expect(result.unscoped.tenant_id).toBeNull();
  });

  it("lazy-loads relations from entities returned by row level security driver queries", async () => {
    await createPolicyFixture();

    const member = await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");
        RowLevelSecurity.setContext("tenant_id", 1);

        const em = orm.em.fork();
        const document = await em.findOneOrFail(
          RowLevelSecurityDocumentEntity,
          {
            id: 1,
          },
        );

        return await document.member.loadOrFail();
      },
    );

    expect(member.name).toBe("tenant-1-member");
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
    const memberTableIdentifier = quoteQualifiedIdentifier(
      DOCUMENT_SCHEMA_NAME,
      MEMBER_TABLE_NAME,
    );

    await execute(
      `grant usage on schema ${quoteIdentifier(DOCUMENT_SCHEMA_NAME)} to authenticated`,
    );
    await execute(`grant all on table ${tableIdentifier} to authenticated`);
    await execute(
      `grant all on table ${memberTableIdentifier} to authenticated`,
    );
    await execute(
      `insert into ${memberTableIdentifier} (id, tenant_id, name) values (1, 1, 'tenant-1-member'), (2, 2, 'tenant-2-member') on conflict (id) do nothing`,
    );
    await execute(
      `insert into ${tableIdentifier} (id, tenant_id, member_id, content) values (1, 1, 1, 'tenant-1'), (2, 2, 2, 'tenant-2') on conflict (id) do nothing`,
    );

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
    await runStatements(
      createPolicyUpSqlStatements({
        schemaName: DOCUMENT_SCHEMA_NAME,
        tableName: MEMBER_TABLE_NAME,
        policyName: `${MEMBER_TABLE_NAME}_tenant_policy`,
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
});
