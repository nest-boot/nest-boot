import "dotenv/config";
import "reflect-metadata";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type EntityClass,
  MikroORM,
  ReflectMetadataProvider,
} from "@mikro-orm/core";
import {
  Entity,
  Knex,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/postgresql";
import { loadConfigFromEnv, MikroOrmModule } from "@nest-boot/mikro-orm";
import { RequestContext } from "@nest-boot/request-context";
import { Test, TestingModule } from "@nestjs/testing";

import {
  createPolicyUpSqlStatements,
  Policy,
  PolicyCommand,
  quoteIdentifier,
  quoteQualifiedIdentifier,
  RowLevelSecurity,
  RowLevelSecurityDriver,
  RowLevelSecurityMigrationGenerator,
  RowLevelSecurityMigrator,
  RowLevelSecurityMode,
} from "../src";

const DOCUMENT_SCHEMA_NAME = `rls_e2e_${String(process.pid)}_${String(
  Date.now(),
)}`;
const DOCUMENT_TABLE_NAME = "documents";
const MEMBER_TABLE_NAME = "members";
const POLICY_MIGRATION_SUFFIX = `${String(process.pid)}_${String(
  Date.now(),
).slice(-8)}`;
const POLICY_MIGRATION_SCHEMA_NAME = `rls_migration_e2e_${POLICY_MIGRATION_SUFFIX}`;
const POLICY_MIGRATION_TABLE_NAME = "policy_documents";
const POLICY_MIGRATION_POLICY_NAME = `${POLICY_MIGRATION_TABLE_NAME}_workspace_select_policy`;
const POLICY_MIGRATION_STORAGE_TABLE = `rls_migrations_${POLICY_MIGRATION_SUFFIX}`;

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

@Policy({
  name: POLICY_MIGRATION_POLICY_NAME,
  command: PolicyCommand.SELECT,
  property: "workspaceId",
  context: "tenant_id",
  roles: ["authenticated"],
})
@Entity({
  schema: POLICY_MIGRATION_SCHEMA_NAME,
  tableName: POLICY_MIGRATION_TABLE_NAME,
})
class RowLevelSecurityMigrationTenantContextEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "workspace_id", type: t.integer })
  workspaceId!: number;
}

@Policy({
  name: POLICY_MIGRATION_POLICY_NAME,
  command: PolicyCommand.SELECT,
  property: "workspaceId",
  context: "workspace_id",
  roles: ["authenticated"],
})
@Entity({
  schema: POLICY_MIGRATION_SCHEMA_NAME,
  tableName: POLICY_MIGRATION_TABLE_NAME,
})
class RowLevelSecurityMigrationWorkspaceContextEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "workspace_id", type: t.integer })
  workspaceId!: number;
}

@Policy({
  name: POLICY_MIGRATION_POLICY_NAME,
  command: PolicyCommand.SELECT,
  property: "workspaceId",
  context: "workspace_id",
  roles: ["authenticated"],
})
@Entity({
  schema: POLICY_MIGRATION_SCHEMA_NAME,
  tableName: POLICY_MIGRATION_TABLE_NAME,
})
class RowLevelSecurityMigrationWorkspaceContextWithExtraFieldEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.string })
  externalId!: string;

  @Property({ fieldName: "workspace_id", type: t.integer })
  workspaceId!: number;
}

@Policy({
  name: POLICY_MIGRATION_POLICY_NAME,
  command: PolicyCommand.SELECT,
  using: `(select nullif(current_setting('app.workspace_id'::text, true), ''::text)::integer) = workspace_id`,
})
@Entity({
  schema: POLICY_MIGRATION_SCHEMA_NAME,
  tableName: POLICY_MIGRATION_TABLE_NAME,
})
class RowLevelSecurityMigrationExplicitWorkspacePolicyEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ fieldName: "workspace_id", type: t.integer })
  workspaceId!: number;
}

@Policy({
  name: POLICY_MIGRATION_POLICY_NAME,
  command: PolicyCommand.SELECT,
  using: `(select nullif(current_setting('app.workspace_id'::text, true), ''::text)::integer) = workspace_id`,
})
@Entity({
  schema: POLICY_MIGRATION_SCHEMA_NAME,
  tableName: POLICY_MIGRATION_TABLE_NAME,
})
class RowLevelSecurityMigrationExplicitWorkspacePolicyWithExtraFieldEntity {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.string })
  externalId!: string;

  @Property({ fieldName: "workspace_id", type: t.integer })
  workspaceId!: number;
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
    await prepareDatabaseRoles();
  }, 30000);

  afterAll(async () => {
    try {
      await dropSchema();
    } finally {
      await testingModule?.close();
    }
  });

  it("reads transaction-local context settings with null-safe casts", async () => {
    const row = await withKnexTransaction(async (trx) => {
      await trx.raw("select set_config('app.user_id', '42', true)");

      const result = await trx.raw<{
        rows: { user_id: number; missing_id: number | null }[];
      }>(
        "select nullif(current_setting('app.user_id', true), '')::integer as user_id, nullif(current_setting('app.missing_id', true), '')::integer as missing_id",
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
          }>("select current_user, nullif(current_setting('app.tenant_id', true), '')::integer as tenant_id", [], "get", trx);
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
          }>("select current_user, nullif(current_setting('app.tenant_id', true), '')::integer as tenant_id", [], "get", trx);

          RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);

          const disabled = await em.getConnection().execute<{
            current_user: string;
            tenant_id: number | null;
          }>("select current_user, nullif(current_setting('app.tenant_id', true), '')::integer as tenant_id", [], "get", trx);

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
          }>("select current_user, nullif(current_setting('app.tenant_id', true), '')::integer as tenant_id", [], "get", trx);
        },
      );

      const unscoped = await em.getConnection().execute<{
        current_user: string;
        tenant_id: number | null;
      }>("select current_user, nullif(current_setting('app.tenant_id', true), '')::integer as tenant_id", [], "get", trx);

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

  it("generates a policy diff after applying a migration and changing only context", async () => {
    const migrationPath = mkdtempSync(join(tmpdir(), "rls-policy-migrations-"));
    let tenantOrm: MikroORM | undefined;
    let workspaceOrm: MikroORM | undefined;

    try {
      await dropGeneratedTestArtifacts(orm);

      tenantOrm = await createPolicyMigrationOrm(
        RowLevelSecurityMigrationTenantContextEntity,
        migrationPath,
      );
      await dropPolicyMigrationSchema(tenantOrm);

      const initialMigration = await (
        tenantOrm.migrator as RowLevelSecurityMigrator
      ).createInitialMigration(migrationPath, "InitialPolicyContext");

      expect(initialMigration.code).toContain(
        "nullif(current_setting('app.tenant_id', true), '')::integer",
      );

      await runGeneratedMigrationUpStatements(tenantOrm, initialMigration.code);
      await tenantOrm.close(true);
      tenantOrm = undefined;

      workspaceOrm = await createPolicyMigrationOrm(
        RowLevelSecurityMigrationWorkspaceContextEntity,
        migrationPath,
      );

      const policyDiffMigration = await (
        workspaceOrm.migrator as RowLevelSecurityMigrator
      ).createMigration(migrationPath, false, false, "UpdatePolicyContext");

      expect(policyDiffMigration.fileName).toMatch(/UpdatePolicyContext\.ts$/);
      expect(policyDiffMigration.diff.up).toEqual([]);
      expect(policyDiffMigration.code).toContain(
        `drop policy if exists ${POLICY_MIGRATION_POLICY_NAME}`,
      );
      expect(policyDiffMigration.code).toContain(
        "nullif(current_setting('app.workspace_id', true), '')::integer",
      );
      expect(policyDiffMigration.code).toContain(
        "nullif(current_setting('app.tenant_id'::text, true), ''::text)::integer",
      );

      await runGeneratedMigrationUpStatements(
        workspaceOrm,
        policyDiffMigration.code,
      );

      const policy = await getGeneratedPolicyExpression(workspaceOrm);

      expect(policy.qual).toContain("workspace_id");
      expect(policy.qual).not.toContain("tenant_id");
    } finally {
      const cleanupOrm = workspaceOrm ?? tenantOrm;

      if (cleanupOrm) {
        await dropPolicyMigrationSchema(cleanupOrm);
      }

      await workspaceOrm?.close(true);
      await tenantOrm?.close(true);
      rmSync(migrationPath, { force: true, recursive: true });
    }
  }, 30000);

  it("does not regenerate unchanged generated policies after an entity field changes", async () => {
    await expectFieldChangeMigrationToKeepPolicy({
      fieldChangeEntity:
        RowLevelSecurityMigrationWorkspaceContextWithExtraFieldEntity,
      fieldChangeMigrationName: "AddPolicyEntityField",
      initialEntity: RowLevelSecurityMigrationWorkspaceContextEntity,
      initialMigrationName: "InitialPolicyField",
      migrationPathPrefix: "rls-field-migrations-",
      expectedInitialPolicyExpression: "workspace_id",
    });
  }, 30000);

  it("does not regenerate unchanged explicit user policies after an entity field changes", async () => {
    await expectFieldChangeMigrationToKeepPolicy({
      fieldChangeEntity:
        RowLevelSecurityMigrationExplicitWorkspacePolicyWithExtraFieldEntity,
      fieldChangeMigrationName: "AddExplicitPolicyEntityField",
      initialEntity: RowLevelSecurityMigrationExplicitWorkspacePolicyEntity,
      initialMigrationName: "InitialExplicitPolicyField",
      migrationPathPrefix: "rls-explicit-field-migrations-",
      expectedInitialPolicyExpression:
        "nullif(current_setting('app.workspace_id'::text, true), ''::text)::integer",
    });
  }, 30000);

  async function expectFieldChangeMigrationToKeepPolicy({
    expectedInitialPolicyExpression,
    fieldChangeEntity,
    fieldChangeMigrationName,
    initialEntity,
    initialMigrationName,
    migrationPathPrefix,
  }: {
    expectedInitialPolicyExpression: string;
    fieldChangeEntity: EntityClass<object>;
    fieldChangeMigrationName: string;
    initialEntity: EntityClass<object>;
    initialMigrationName: string;
    migrationPathPrefix: string;
  }) {
    const migrationPath = mkdtempSync(join(tmpdir(), migrationPathPrefix));
    let initialOrm: MikroORM | undefined;
    let fieldChangeOrm: MikroORM | undefined;

    try {
      await dropGeneratedTestArtifacts(orm);

      initialOrm = await createPolicyMigrationOrm(initialEntity, migrationPath);
      await dropPolicyMigrationSchema(initialOrm);

      const initialMigration = await (
        initialOrm.migrator as RowLevelSecurityMigrator
      ).createInitialMigration(migrationPath, initialMigrationName);

      await runGeneratedMigrationUpStatements(
        initialOrm,
        initialMigration.code,
      );

      const initialPolicy = await getGeneratedPolicyExpression(initialOrm);

      expect(initialPolicy.qual).toContain(expectedInitialPolicyExpression);

      await initialOrm.close(true);
      initialOrm = undefined;

      fieldChangeOrm = await createPolicyMigrationOrm(
        fieldChangeEntity,
        migrationPath,
      );

      const fieldChangeMigration = await (
        fieldChangeOrm.migrator as RowLevelSecurityMigrator
      ).createMigration(migrationPath, false, false, fieldChangeMigrationName);

      expect(fieldChangeMigration.fileName).toMatch(
        new RegExp(`${fieldChangeMigrationName}\\.ts$`),
      );
      expect(fieldChangeMigration.code).toContain('add column "external_id"');
      expect(fieldChangeMigration.code).not.toContain(
        `drop policy if exists ${POLICY_MIGRATION_POLICY_NAME}`,
      );
      expect(fieldChangeMigration.code).not.toContain(
        `create policy ${POLICY_MIGRATION_POLICY_NAME}`,
      );

      await runGeneratedMigrationUpStatements(
        fieldChangeOrm,
        fieldChangeMigration.code,
      );

      const fieldChangePolicy =
        await getGeneratedPolicyExpression(fieldChangeOrm);

      expect(fieldChangePolicy.qual).toBe(initialPolicy.qual);
    } finally {
      const cleanupOrm = fieldChangeOrm ?? initialOrm;

      if (cleanupOrm) {
        await dropPolicyMigrationSchema(cleanupOrm);
      }

      await fieldChangeOrm?.close(true);
      await initialOrm?.close(true);
      rmSync(migrationPath, { force: true, recursive: true });
    }
  }

  async function resetSchema() {
    await dropSchema();
    await orm.schema.createSchema({ schema: DOCUMENT_SCHEMA_NAME });
  }

  async function prepareDatabaseRoles() {
    await execute(
      "do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;",
    );
    await execute("grant authenticated to current_user;");
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
          "((select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id)",
        withCheck:
          "((select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id)",
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
          "((select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id)",
        withCheck:
          "((select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id)",
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

  async function createPolicyMigrationOrm<T extends object>(
    entity: EntityClass<T>,
    migrationPath: string,
  ) {
    const databaseConfig = await loadConfigFromEnv();

    return await MikroORM.init({
      ...databaseConfig,
      allowGlobalContext: true,
      driver: RowLevelSecurityDriver,
      entities: [entity],
      entitiesTs: [entity],
      extensions: [RowLevelSecurityMigrator],
      metadataCache: {
        enabled: false,
      },
      metadataProvider: ReflectMetadataProvider,
      migrations: {
        dropTables: false,
        emit: "ts",
        generator: RowLevelSecurityMigrationGenerator,
        path: migrationPath,
        pathTs: migrationPath,
        snapshot: false,
        tableName: POLICY_MIGRATION_STORAGE_TABLE,
      },
      schema: POLICY_MIGRATION_SCHEMA_NAME,
    });
  }

  async function dropPolicyMigrationSchema(targetOrm: MikroORM) {
    await targetOrm.schema.dropSchema({
      dropDb: false,
      dropMigrationsTable: false,
      schema: POLICY_MIGRATION_SCHEMA_NAME,
    });
    await targetOrm.em
      .getConnection()
      .execute(
        `drop table if exists ${quoteIdentifier(
          POLICY_MIGRATION_STORAGE_TABLE,
        )} cascade`,
      );
  }

  async function dropGeneratedTestArtifacts(targetOrm: MikroORM) {
    const schemas = await targetOrm.em.getConnection().execute<
      { nspname: string }[]
    >(/* SQL */ `
        SELECT nspname
        FROM pg_namespace
        WHERE nspname LIKE 'rls_e2e_%'
          OR nspname LIKE 'rls_migration_e2e_%'
      `);

    for (const { nspname } of schemas) {
      await targetOrm.em
        .getConnection()
        .execute(`drop schema if exists ${quoteIdentifier(nspname)} cascade`);
    }

    const tables = await targetOrm.em.getConnection().execute<
      { tablename: string }[]
    >(/* SQL */ `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'rls_migrations_%'
      `);

    for (const { tablename } of tables) {
      await targetOrm.em
        .getConnection()
        .execute(`drop table if exists ${quoteIdentifier(tablename)} cascade`);
    }
  }

  async function runGeneratedMigrationUpStatements(
    targetOrm: MikroORM,
    code: string,
  ) {
    for (const statement of getGeneratedMigrationUpStatements(code)) {
      await targetOrm.em.getConnection().execute(statement);
    }
  }

  function getGeneratedMigrationUpStatements(code: string) {
    const upStart = code.indexOf("async up()");
    const downStart = code.indexOf("async down()", upStart);
    const upCode = code.slice(
      upStart,
      downStart === -1 ? undefined : downStart,
    );

    return [...upCode.matchAll(/this\.addSql\(`((?:\\.|[^`])*)`\);/g)].map(
      ([, sql]) => unescapeGeneratedMigrationSql(sql),
    );
  }

  function unescapeGeneratedMigrationSql(sql: string) {
    return sql.replace(/\\([`$\\])/g, "$1");
  }

  async function getGeneratedPolicyExpression(targetOrm: MikroORM) {
    return await targetOrm.em.getConnection().execute<{ qual: string }>(
      /* SQL */ `
        SELECT pg_get_expr(p.polqual, p.polrelid) AS qual
        FROM pg_policy p
        INNER JOIN pg_class c ON c.oid = p.polrelid
        INNER JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = '${POLICY_MIGRATION_SCHEMA_NAME}'
          AND c.relname = '${POLICY_MIGRATION_TABLE_NAME}'
          AND p.polname = '${POLICY_MIGRATION_POLICY_NAME}'
      `,
      [],
      "get",
    );
  }
});
