import { TSMigrationGenerator } from "@mikro-orm/migrations";

import { Policy } from "./decorators/policy.decorator";
import { PolicyCommand } from "./enums/policy-command.enum";
import { RowLevelSecurityMigrationGenerator } from "./row-level-security-migration-generator";

@Policy({
  name: "workspace_member_user_select_policy",
  command: PolicyCommand.SELECT,
  using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
})
class WorkspaceMember {}

@Policy({
  name: "workspace_member_user_select_policy",
  command: PolicyCommand.SELECT,
  using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
})
@Policy({
  name: "workspace_member_write_policy",
  using: `((select app.get_context('workspace_id', null::bigint)) = "workspace_id")`,
  withCheck: `((select app.get_context('workspace_id', null::bigint)) = "workspace_id")`,
})
class WorkspaceMemberWithMultiplePolicies {}

@Policy({
  command: PolicyCommand.SELECT,
  property: "user",
  context: "user_id",
})
class WorkspaceMemberWithGeneratedPolicy {}

@Policy({
  name: "audit_log_select_policy",
  command: PolicyCommand.SELECT,
  using: "true",
})
class AuditLog {}

class UnmanagedEntity {}

describe("RowLevelSecurityMigrationGenerator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads existing policies from the database while generating migrations", async () => {
    const execute = jest.fn((_sql: string) =>
      Promise.resolve([
        {
          policy_name: "workspace_member_user_select_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "r",
          qual: "true",
          with_check: null,
          roles: ["authenticated"],
        },
        {
          policy_name: "workspace_member_insert_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: false,
          command: "a",
          qual: null,
          with_check: "true",
          roles: ["authenticated"],
        },
        {
          policy_name: "workspace_member_update_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "w",
          qual: "true",
          with_check: "true",
          roles: ["authenticated"],
        },
        {
          policy_name: "workspace_member_delete_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "d",
          qual: "true",
          with_check: null,
          roles: ["authenticated"],
        },
        {
          policy_name: "workspace_member_all_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "*",
          qual: "true",
          with_check: "true",
          roles: ["authenticated"],
        },
      ]),
    );
    const superGenerate = jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockImplementation(function (this: RowLevelSecurityMigrationGenerator) {
        expect((this as any).existingPolicyDefinitions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              policyName: "workspace_member_insert_policy",
              mode: "restrictive",
              command: "insert",
              withCheck: "true",
              roles: ["authenticated"],
            }),
            expect.objectContaining({
              policyName: "workspace_member_delete_policy",
              command: "delete",
              using: "true",
            }),
            expect.objectContaining({
              policyName: "workspace_member_all_policy",
              command: "all",
            }),
          ]),
        );
        expect((this as any).currentPolicyDefinitions).toEqual([
          expect.objectContaining({
            policyName: "workspace_member_user_select_policy",
            tableName: "workspace_member",
          }),
        ]);

        return Promise.resolve(["migration-file", "/tmp/Migration.ts"]);
      });
    const generator = createGenerator(
      [
        {
          class: WorkspaceMember,
          tableName: "workspace_member",
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
    );

    await expect(
      generator.generate({ up: [], down: [] }, "/tmp", "Migration"),
    ).resolves.toEqual(["migration-file", "/tmp/Migration.ts"]);

    expect(superGenerate).toHaveBeenCalledWith(
      { up: [], down: [] },
      "/tmp",
      "Migration",
    );
    expect(execute.mock.calls[0]?.[0]).toContain(
      "('public', 'workspace_member')",
    );
    expect(execute.mock.calls[0]?.[0]).toContain("unnest(p.polroles)");
    expect((generator as any).existingPolicyDefinitions).toBeUndefined();
    expect((generator as any).currentPolicyDefinitions).toBeUndefined();
  });

  it("continues generation when the driver has no database connection", async () => {
    const superGenerate = jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockImplementation(function (this: RowLevelSecurityMigrationGenerator) {
        expect((this as any).existingPolicyDefinitions).toEqual([]);

        return Promise.resolve(["migration-file", "/tmp/Migration.ts"]);
      });
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);

    await expect(generator.generate({ up: [], down: [] })).resolves.toEqual([
      "migration-file",
      "/tmp/Migration.ts",
    ]);
    expect(superGenerate).toHaveBeenCalledTimes(1);
  });

  it("skips database policy lookup when metadata has no entity classes", async () => {
    const execute = jest.fn();
    jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockResolvedValue(["migration-file", "/tmp/Migration.ts"]);
    const generator = createGenerator(
      [
        {
          tableName: "workspace_member",
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
    );

    await generator.generate({ up: [], down: [] });

    expect(execute).not.toHaveBeenCalled();
  });

  it("only loads existing database policies for tables managed by Policy metadata", async () => {
    const execute = jest.fn((_sql: string) => Promise.resolve([]));
    jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockResolvedValue(["migration-file", "/tmp/Migration.ts"]);
    const generator = createGenerator(
      [
        {
          class: WorkspaceMember,
          tableName: "workspace_member",
        },
        {
          class: UnmanagedEntity,
          tableName: "unmanaged_entity",
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
    );

    await generator.generate({ up: [], down: [] });

    expect(execute.mock.calls[0]?.[0]).toContain(
      "('public', 'workspace_member')",
    );
    expect(execute.mock.calls[0]?.[0]).not.toContain("unmanaged_entity");
  });

  it("throws when MikroORM metadata is unavailable", () => {
    const generator = new RowLevelSecurityMigrationGenerator(
      {} as never,
      {} as never,
      { emit: "ts" } as never,
    );

    expect(() =>
      generator.generateMigrationFile("MigrationTest", {
        up: [],
        down: [],
      }),
    ).toThrow("MikroORM metadata storage is not available");
  });

  it("throws when a policy entity does not expose a table name", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
      },
    ]);

    expect(() =>
      generator.generateMigrationFile("MigrationTest", {
        up: [],
        down: [],
      }),
    ).toThrow("Policy entity WorkspaceMember does not have a table name");
  });

  it("generates RowLevelSecurityMigration files with policy up and down SQL", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        schema: "*",
        tableName: "workspace_member",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: ['create table "workspace_member" ("user_id" bigint null);'],
      down: ['drop table if exists "workspace_member" cascade;'],
    });

    expect(file).toContain(
      "import { RowLevelSecurityMigration } from '@nest-boot/row-level-security';",
    );
    expect(file).toContain("extends RowLevelSecurityMigration");
    expect(
      file.indexOf("create policy workspace_member_user_select_policy"),
    ).toBeGreaterThan(file.indexOf('create table "workspace_member"'));
    expect(
      file.indexOf("drop policy if exists workspace_member_user_select_policy"),
    ).toBeLessThan(
      file.indexOf('drop table if exists "workspace_member" cascade;'),
    );
  });

  it("throws when MikroORM migration output cannot be converted to the RLS base class", () => {
    jest
      .spyOn(TSMigrationGenerator.prototype, "generateMigrationFile")
      .mockReturnValue("export class MigrationTest {}");
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);

    expect(() =>
      generator.generateMigrationFile("MigrationTest", {
        up: [],
        down: [],
      }),
    ).toThrow("MikroORM migration output format is not supported");
  });

  it("generates policy SQL for all policy entities in a blank migration", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain("extends RowLevelSecurityMigration");
    expect(file).toContain(
      "this.addSql(`do \\$\\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end \\$\\$;`);",
    );
    expect(file).toContain("this.addSql(`create schema if not exists app;`);");
    expect(file).toContain(
      "this.addSql(`create or replace function app.get_context(context_key text, context_type anyelement) returns anyelement as \\$\\$ declare context_value text; begin context_value := current_setting('app.' || context_key, true); if context_value is null or context_value = '' then return null; end if; execute format('select \\$1::%s', pg_typeof(context_type)::text) using context_value into context_type; return context_type; end; \\$\\$ language plpgsql stable;`);",
    );
    expect(file).not.toContain("get_tenant_id()");
    expect(file).not.toContain("get_policy_context");
    expect(file).not.toContain("create schema if not exists extensions");
    expect(file).not.toContain("grant usage on schema extensions");
    expect(file).toContain(
      'this.addSql(`alter table "public"."workspace_member" enable row level security;`);',
    );
    expect(file).toContain(
      'this.addSql(`drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";`);',
    );
    expect(file).toContain(
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select app.get_context(\'user_id\', null::bigint)) = "user_id");`);',
    );
  });

  it("handles removed policies when an existing database policy is no longer declared", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);
    (generator as any).existingPolicyDefinitions = [
      {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "removed_workspace_member_policy",
        command: PolicyCommand.SELECT,
        using: "true",
        roles: ["authenticated"],
      },
    ];

    const file = generator.generateMigrationFile("MigrationTest", {
      up: ['alter table "workspace_member" add column "display_name" text;'],
      down: ['alter table "workspace_member" drop column "display_name";'],
    });

    expect(file).toContain(
      "drop policy if exists removed_workspace_member_policy",
    );
    expect(file).toContain("create policy workspace_member_user_select_policy");
    expect(file).toContain("create policy removed_workspace_member_policy");
    expect(file).toContain("create policy removed_workspace_member_policy on");
    expect(file).toContain("for select to authenticated using true");
  });

  it("recreates policies when an existing policy changes content", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);
    (generator as any).existingPolicyDefinitions = [
      {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_user_select_policy",
        command: PolicyCommand.SELECT,
        using: "false",
        roles: ["authenticated"],
      },
    ];

    const file = generator.generateMigrationFile("MigrationTest", {
      up: ['alter table "workspace_member" add column "display_name" text;'],
      down: ['alter table "workspace_member" drop column "display_name";'],
    });

    expect(file).toContain(
      "drop policy if exists workspace_member_user_select_policy",
    );
    expect(file).toContain(
      "create policy workspace_member_user_select_policy on",
    );
    expect(file).toContain(
      "using ((select app.get_context('user_id', null::bigint)) = \"user_id\")",
    );
    expect(file).toContain("for select to authenticated using false");
  });

  it("matches create table statements for non-public schemas and collection names", () => {
    const generator = createGenerator([
      {
        class: AuditLog,
        schema: "app",
        collection: "audit_log",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: ['create table if not exists "app"."audit_log" ("id" bigint);'],
      down: ['drop table if exists "app"."audit_log";'],
    });

    expect(file).toContain(
      'this.addSql(`create policy audit_log_select_policy on "app"."audit_log" as permissive for select using true;`);',
    );
  });

  it("generates all policies declared on an entity", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithMultiplePolicies,
        tableName: "workspace_member",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      'this.addSql(`create policy workspace_member_write_policy on "public"."workspace_member" as permissive for all using ((select app.get_context(\'workspace_id\', null::bigint)) = "workspace_id") with check ((select app.get_context(\'workspace_id\', null::bigint)) = "workspace_id");`);',
    );
    expect(file).toContain(
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select app.get_context(\'user_id\', null::bigint)) = "user_id");`);',
    );
  });

  it("generates property context policy SQL from entity metadata", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithGeneratedPolicy,
        tableName: "workspace_member",
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["integer"],
            targetMeta: {
              primaryKeys: ["id"],
              properties: {
                id: {
                  columnTypes: ["bigint"],
                },
              },
            },
          },
        },
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select app.get_context(\'user_id\', null::bigint)) = "user_id");`);',
    );
  });

  it("keeps default MikroORM output for unrelated schema changes", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [
        'alter table "workspace_member" add column "display_name" text null;',
      ],
      down: ['alter table "workspace_member" drop column "display_name";'],
    });

    expect(file).toContain(
      "import { Migration } from '@mikro-orm/migrations';",
    );
    expect(file).toContain("extends Migration");
    expect(file).not.toContain("workspace_member_user_select_policy");
  });

  it("keeps default MikroORM output when no entities use Policy", () => {
    const generator = createGenerator([]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: ["select 1;"],
      down: [],
    });

    expect(file).toContain(
      "import { Migration } from '@mikro-orm/migrations';",
    );
    expect(file).toContain("extends Migration");
  });

  it("is a MikroORM TypeScript migration generator", () => {
    expect(RowLevelSecurityMigrationGenerator.prototype).toBeInstanceOf(
      TSMigrationGenerator,
    );
  });
});

function createGenerator(
  metadata: object[],
  driverOptions: Record<string, unknown> = {},
) {
  return new RowLevelSecurityMigrationGenerator(
    {
      config: {
        getMetadata: () => ({
          getAll: () => metadata,
        }),
      },
      ...driverOptions,
    } as never,
    {} as never,
    { emit: "ts" } as never,
  );
}
