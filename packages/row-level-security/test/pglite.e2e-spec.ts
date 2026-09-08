import "reflect-metadata";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  MikroORM as CoreMikroORM,
  Ref,
  Transaction,
} from "@mikro-orm/core";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  ReflectMetadataProvider,
} from "@mikro-orm/decorators/legacy";
import { MikroORM, t } from "@mikro-orm/pglite";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { RequestContext } from "@nest-boot/request-context";
import { Test, type TestingModule } from "@nestjs/testing";

import {
  Policy,
  PolicyCommand,
  RowLevelSecurity,
  RowLevelSecurityMigration,
  RowLevelSecurityMigrationGenerator,
  RowLevelSecurityMigrator,
  RowLevelSecurityMode,
} from "../src/index.js";
import { PgliteRowLevelSecurityDriver } from "../src/pglite.js";

@Entity({ tableName: "members" })
class Member {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.string })
  name!: string;
}

@Policy({
  name: "documents_tenant_policy",
  command: PolicyCommand.ALL,
  property: "tenantId",
  context: "tenant_id",
  roles: ["authenticated"],
})
@Entity({ tableName: "documents" })
class Document {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.integer })
  tenantId!: number;

  @Property({ type: t.string })
  content!: string;

  @ManyToOne(() => Member, { ref: true })
  member!: Ref<Member>;
}

class InitialRlsMigration extends RowLevelSecurityMigration {
  override up(): void {
    this.addSql(
      "create table members (id serial primary key, name varchar(255) not null)",
    );
    this.addSql(
      "create table documents (id serial primary key, tenant_id integer not null, content varchar(255) not null, member_id integer not null, constraint documents_member_id_foreign foreign key (member_id) references members(id))",
    );
    this.addSql("grant select on members to authenticated");
    this.addPolicySql({
      schemaName: "public",
      tableName: "documents",
      policyName: "documents_tenant_policy",
      command: PolicyCommand.ALL,
      roles: ["authenticated"],
      using:
        "(select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id",
      withCheck:
        "(select nullif(current_setting('app.tenant_id', true), '')::integer) = tenant_id",
    });
    this.addSql("alter table documents force row level security");
  }

  override down(): void {
    this.addSql("drop table documents");
    this.addSql("drop table members");
  }
}

describe("PGlite row-level security", () => {
  let orm: CoreMikroORM<PgliteRowLevelSecurityDriver>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({
          driver: PgliteRowLevelSecurityDriver,
          dbName: "memory://",
          autoLoadEntities: true,
          allowGlobalContext: true,
          metadataProvider: ReflectMetadataProvider,
          metadataCache: { enabled: false },
          extensions: [RowLevelSecurityMigrator],
          migrations: {
            migrationsList: [InitialRlsMigration],
            generator: RowLevelSecurityMigrationGenerator,
            snapshot: false,
          },
        }),
        MikroOrmModule.forFeature([Document, Member]),
      ],
    }).compile();
    await module.init();
    orm = module.get(MikroORM);
    // Roles remain administrator-managed, just like the PostgreSQL driver.
    await execute("create role authenticated nologin");
    await execute("create role anonymous nologin");
    await orm.migrator.up();
  }, 30000);

  afterAll(async () => {
    await module?.close();
  });

  beforeEach(async () => {
    orm.em.clear();
    await execute("truncate documents, members restart identity");
    await execute("insert into members (name) values ('first'), ('second')");
    await execute(
      "insert into documents (tenant_id, content, member_id) values (1, 'first', 1), (2, 'second', 2)",
    );
  });

  it("registers the PGlite ORM token and applies migrations", async () => {
    expect(orm.driver).toBeInstanceOf(PgliteRowLevelSecurityDriver);
    const executed = await orm.migrator.getExecuted();
    expect(executed.map(({ name }) => name)).toContain("InitialRlsMigration");
    await expect(execute("select polname from pg_policy")).resolves.toEqual([
      { polname: "documents_tenant_policy" },
    ]);
  });

  it("filters ORM queries and lazy-loaded relations under the selected tenant", async () => {
    await scoped(1, async () => {
      const documents = await orm.em.fork().find(Document, {});
      expect(documents.map(({ tenantId }) => tenantId)).toEqual([1]);
      expect((await documents[0].member.loadOrFail()).name).toBe("first");
      expect(await state()).toMatchObject({
        role: "authenticated",
        tenant: "1",
      });
    });
    await expect(orm.em.fork().count(Document)).resolves.toBe(2);
    expect(await state()).toMatchObject({ tenant: "", request: "" });
    expect((await state()).role).not.toBe("authenticated");
  });

  it("enforces INSERT, UPDATE, and DELETE policies", async () => {
    await scoped(1, async () => {
      const em = orm.em.fork();
      await expect(
        em.insert(Document, { tenantId: 2, content: "forbidden", member: 2 }),
      ).rejects.toThrow(/row-level security/i);
      await expect(
        em.nativeUpdate(Document, { tenantId: 2 }, { content: "forbidden" }),
      ).resolves.toBe(0);
      await expect(em.nativeDelete(Document, { tenantId: 2 })).resolves.toBe(0);
      await em.insert(Document, { tenantId: 1, content: "allowed", member: 1 });
      await expect(em.count(Document)).resolves.toBe(2);
      await expect(
        em.nativeUpdate(
          Document,
          { content: "allowed" },
          { content: "updated" },
        ),
      ).resolves.toBe(1);
      await expect(
        em.nativeDelete(Document, { content: "updated" }),
      ).resolves.toBe(1);
    });
  });

  it("handles context values containing semicolons and quotes without splitting SQL literals", async () => {
    await scoped(1, async () => {
      RowLevelSecurity.setContext("request_id", "a'; b; c");
      expect(await state()).toMatchObject({ request: "a'; b; c" });
    });
  });

  it("switches tenants and removes stale context keys inside an existing transaction", async () => {
    await orm.em.getConnection().transactional(async (trx) => {
      await scoped(1, async () => {
        RowLevelSecurity.setContext("request_id", "first-request");
        expect(await state(trx)).toMatchObject({
          tenant: "1",
          request: "first-request",
        });
      });
      await scoped(2, async () => {
        expect(await state(trx)).toMatchObject({ tenant: "2", request: "" });
        expect(await execute("select tenant_id from documents", trx)).toEqual([
          { tenant_id: 2 },
        ]);
      });
    });
  });

  it.each(["disabled", "cleared", "outside"] as const)(
    "clears transaction state when %s",
    async (mode) => {
      await orm.em.getConnection().transactional(async (trx) => {
        await scoped(1, async () => {
          RowLevelSecurity.setContext("request_id", "active");
          await state(trx);
          if (mode === "disabled") {
            RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
          } else if (mode === "cleared") {
            RowLevelSecurity.clear();
          } else {
            return;
          }
          expect(await state(trx)).toMatchObject({ tenant: "", request: "" });
          expect((await state(trx)).role).not.toBe("authenticated");
        });
        expect(await state(trx)).toMatchObject({ tenant: "", request: "" });
        expect(
          await execute(
            "select tenant_id from documents order by tenant_id",
            trx,
          ),
        ).toHaveLength(2);
      });
    },
  );

  it("uses the anonymous fallback role when RLS is enabled without a role", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      expect((await state()).role).toBe("anonymous");
      await expect(orm.em.fork().find(Document, {})).rejects.toThrow(
        /permission denied/i,
      );
    });
  });

  it("isolates concurrent request scopes on PGlite's single connection", async () => {
    const results = await Promise.all(
      [1, 2, 1, 2].map((tenant) =>
        scoped(tenant, async () =>
          (await orm.em.fork().find(Document, {})).map(
            ({ tenantId }) => tenantId,
          ),
        ),
      ),
    );
    expect(results).toEqual([[1], [2], [1], [2]]);
  });

  it("serializes setup and execution when queries share a transaction", async () => {
    await orm.em.getConnection().transactional(async (trx) => {
      const rows = await Promise.all(
        [1, 2, 1, 2].map((tenant) => scoped(tenant, () => state(trx))),
      );
      expect(rows.map(({ tenant }) => tenant)).toEqual(["1", "2", "1", "2"]);
    });
  });

  it("rolls back a failed query without retaining its role or settings", async () => {
    await expect(scoped(1, () => execute("select 1 / 0"))).rejects.toThrow(
      /division by zero/i,
    );
    expect((await state()).role).not.toBe("authenticated");
    await scoped(2, async () => {
      expect((await state()).tenant).toBe("2");
      expect(await orm.em.fork().count(Document)).toBe(1);
    });
  });

  it("applies RLS to EntityManager transactions", async () => {
    await scoped(1, async () => {
      await orm.em.transactional(async (em) => {
        expect(await em.count(Document)).toBe(1);
        await em.insert(Document, {
          tenantId: 1,
          content: "transaction",
          member: 1,
        });
        expect(await em.count(Document)).toBe(2);
      });
    });
    expect(await orm.em.fork().count(Document)).toBe(3);
  });

  it("preserves policies and data when a file-backed database is reopened", async () => {
    const path = await mkdtemp(join(tmpdir(), "rls-pglite-persistent-"));
    const options = {
      driver: PgliteRowLevelSecurityDriver,
      dbName: join(path, "database"),
      entities: [Document, Member],
      metadataProvider: ReflectMetadataProvider,
      metadataCache: { enabled: false },
      extensions: [RowLevelSecurityMigrator],
      migrations: {
        migrationsList: [InitialRlsMigration],
        generator: RowLevelSecurityMigrationGenerator,
        snapshot: false,
      },
    };
    let persistentOrm: CoreMikroORM<PgliteRowLevelSecurityDriver> | undefined;
    try {
      persistentOrm = await MikroORM.init(options);
      await persistentOrm.em
        .getConnection()
        .execute("create role authenticated nologin");
      await persistentOrm.migrator.up();
      await persistentOrm.em
        .getConnection()
        .execute("insert into members (name) values ('persisted')");
      await persistentOrm.em
        .getConnection()
        .execute(
          "insert into documents (tenant_id, content, member_id) values (1, 'persisted', 1), (2, 'hidden', 1)",
        );
      await persistentOrm.close();

      persistentOrm = await MikroORM.init(options);
      const reopenedOrm = persistentOrm;
      await scoped(1, async () => {
        const documents = await reopenedOrm.em.fork().find(Document, {});
        expect(documents.map(({ content }) => content)).toEqual(["persisted"]);
      });
    } finally {
      await persistentOrm?.close();
      await rm(path, { recursive: true, force: true });
    }
  }, 30000);

  it("introspects live policies and generates policy-only changes", async () => {
    const migrator = orm.migrator as RowLevelSecurityMigrator;
    const path = await mkdtemp(join(tmpdir(), "rls-pglite-migrations-"));
    try {
      expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
      expect(
        (await migrator.create(path, false, false, "Unchanged")).code,
      ).toBe("");
      expect(await migrator.checkSchema()).toBe(false);
      await execute(
        "alter policy documents_tenant_policy on documents using (true) with check (true)",
      );
      expect(await migrator.checkSchema()).toBe(true);
      const migration = await migrator.create(
        path,
        false,
        false,
        "RestoreTenantPolicy",
      );
      expect(migration.code).toContain("extends RowLevelSecurityMigration");
      expect(migration.code).toContain(
        "drop policy if exists documents_tenant_policy",
      );
      expect(migration.code).toContain("create policy documents_tenant_policy");
      expect(migration.code).toContain("app.tenant_id");
      expect(migration.code).not.toContain("create table");
      // Execute the generated up/down SQL as migrations, including DO blocks.
      const [upCode, downCode] = migration.code.split("override down()");
      await runGeneratedSql(upCode);
      expect(await migrator.checkSchema()).toBe(false);
      await scoped(1, async () => {
        expect(await orm.em.fork().count(Document)).toBe(1);
      });
      await runGeneratedSql(downCode);
      expect(await migrator.checkSchema()).toBe(true);
      await runGeneratedSql(upCode);
      expect(await migrator.checkSchema()).toBe(false);
    } finally {
      await orm.migrator.down();
      await orm.migrator.up();
      await rm(path, { recursive: true, force: true });
    }
  });

  function execute(sql: string, trx?: Transaction) {
    return orm.em.getConnection().execute(sql, [], "all", trx);
  }

  async function runGeneratedSql(code: string) {
    const statements = [
      ...code.matchAll(/this\.addSql\(`((?:\\.|[^`])*)`\);/g),
    ].map(([, sql]) => sql.replace(/\\([`$\\])/g, "$1"));
    expect(statements.length).toBeGreaterThan(0);
    await orm.em.getConnection().transactional(async (trx) => {
      for (const sql of statements) {
        await execute(sql, trx);
      }
    });
  }

  async function state(trx?: Transaction) {
    const [row] = await orm.em.getConnection().execute<
      {
        role: string;
        tenant: string;
        request: string;
      }[]
    >("select current_user as role, coalesce(current_setting('app.tenant_id', true), '') as tenant, coalesce(current_setting('app.request_id', true), '') as request", [], "all", trx);
    return row;
  }
});

function scoped<T>(tenant: number, callback: () => Promise<T>): Promise<T> {
  return RequestContext.run(new RequestContext({ type: "test" }), () => {
    RowLevelSecurity.setRole("authenticated");
    RowLevelSecurity.setContext("tenant_id", tenant);
    return callback();
  });
}
