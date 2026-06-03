import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TSMigrationGenerator } from "@mikro-orm/migrations";

import { Policy } from "./decorators/policy.decorator";
import { PolicyCommand } from "./enums/policy-command.enum";
import { RowLevelSecurityMigrationGenerator } from "./row-level-security-migration-generator";
import { RowLevelSecurityMigrator } from "./row-level-security-migrator";

@Policy({
  name: "workspace_member_user_select_policy",
  command: PolicyCommand.SELECT,
  using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
})
class WorkspaceMember {}

@Policy({
  name: "workspace_member_user_select_policy",
  command: PolicyCommand.SELECT,
  using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
})
@Policy({
  name: "workspace_member_write_policy",
  using: `((select current_setting('app.workspace_id', true)::bigint) = "workspace_id")`,
  withCheck: `((select current_setting('app.workspace_id', true)::bigint) = "workspace_id")`,
})
class WorkspaceMemberWithMultiplePolicies {}

@Policy({
  command: PolicyCommand.SELECT,
  property: "user",
  context: "user_id",
})
class WorkspaceMemberWithGeneratedPolicy {}

@Policy({
  name: "workspace_member_workspace_select_policy",
  command: PolicyCommand.SELECT,
  property: "workspace",
  context: "workspace_id",
  roles: ["authenticated"],
})
class WorkspaceMemberWithWorkspaceContextPolicy {}

@Policy({
  command: PolicyCommand.ALL,
  property: "workspace",
  context: "workspace_id",
  roles: ["authenticated"],
})
class WorkspaceMemberGroupMemberWithLongGeneratedPolicy {}

@Policy({
  name: "audit_log_select_policy",
  command: PolicyCommand.SELECT,
  using: "true",
})
class AuditLog {}

@Policy({
  name: "workspace_member_admin_select_policy",
  command: PolicyCommand.SELECT,
  using: "true",
  roles: ["workspace_admin"],
})
class WorkspaceMemberWithCustomRole {}

@Policy({
  name: "workspace_member_admin_select_policy",
  command: PolicyCommand.SELECT,
  using: "true",
  roles: ["workspace_admin"],
})
@Policy({
  name: "workspace_member_admin_update_policy",
  command: PolicyCommand.UPDATE,
  using: "true",
  withCheck: "true",
  roles: ["workspace_admin"],
})
class WorkspaceMemberWithSharedRolePolicies {}

class UnmanagedEntity {}

const WORKSPACE_MEMBER_FIELD_CHANGE_DIFF = {
  up: ['alter table "workspace_member" add column "display_name" text null;'],
  down: ['alter table "workspace_member" drop column "display_name";'],
};
const WORKSPACE_MEMBER_GROUP_MEMBER_FIELD_CHANGE_DIFF = {
  up: [
    'alter table "workspace_member_group_member" add column "display_name" text null;',
  ],
  down: [
    'alter table "workspace_member_group_member" drop column "display_name";',
  ],
};
const LONG_GENERATED_POLICY_NAME =
  "workspace_member_group_member_workspace_all_authenticated_policy";
const LONG_GENERATED_POLICY_NAME_POSTGRES_TRUNCATED =
  "workspace_member_group_member_workspace_all_authenticated_polic";
const LONG_GENERATED_POLICY_NAME_SHORTENED =
  "workspace_member_group_member_workspace_all_authe_fb4ec_policy";

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
        {
          policy_name: "workspace_member_public_select_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "r",
          qual: "true",
          with_check: null,
          roles: null,
        },
        {
          policy_name: "workspace_member_string_roles_select_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "r",
          qual: "true",
          with_check: null,
          roles: "{authenticated,anonymous}",
        },
        {
          policy_name: "external_workspace_policy",
          schema_name: "external",
          table_name: "workspace",
          permissive: true,
          command: "r",
          qual: "true",
          with_check: null,
          roles: ["workspace_admin"],
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
            expect.objectContaining({
              policyName: "workspace_member_public_select_policy",
              roles: [],
            }),
            expect.objectContaining({
              policyName: "workspace_member_string_roles_select_policy",
              roles: ["anonymous", "authenticated"],
            }),
          ]),
        );
        expect((this as any).existingPolicyDefinitions).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              policyName: "external_workspace_policy",
            }),
          ]),
        );
        expect((this as any).existingPolicyRoleDefinitions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              policyName: "external_workspace_policy",
              roles: ["workspace_admin"],
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
    expect(execute.mock.calls[0]?.[0]).toContain("FROM pg_policy");
    expect(execute.mock.calls[0]?.[0]).toContain("unnest(p.polroles)");
    expect((generator as any).existingPolicyDefinitions).toBeUndefined();
    expect((generator as any).existingPolicyRoleDefinitions).toBeUndefined();
    expect((generator as any).currentPolicyDefinitions).toBeUndefined();
  });

  it("continues generation when the driver has no database connection", async () => {
    const superGenerate = jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockImplementation(function (this: RowLevelSecurityMigrationGenerator) {
        expect((this as any).existingPolicyDefinitions).toBeUndefined();

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

  it("detects pending policy-only changes from existing database policies", async () => {
    const execute = jest.fn((_sql: string) =>
      Promise.resolve([
        {
          policy_name: "workspace_member_workspace_select_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "r",
          qual: "(( SELECT current_setting('app.tenant_id'::text, true)::bigint) = workspace_id)",
          with_check: null,
          roles: ["authenticated"],
        },
      ]),
    );
    const generator = createGenerator(
      [
        {
          class: WorkspaceMemberWithWorkspaceContextPolicy,
          tableName: "workspace_member",
          properties: {
            workspace: {
              fieldNames: ["workspace_id"],
              columnTypes: ["bigint"],
            },
          },
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
    );

    await expect(
      generator.hasPendingPolicyChanges({ up: [], down: [] }),
    ).resolves.toBe(true);
    expect((generator as any).existingPolicyDefinitions).toBeUndefined();
    expect((generator as any).currentPolicyDefinitions).toBeUndefined();
  });

  it("does not recreate policies for unrelated schema changes without a database connection", async () => {
    const superGenerate = mockBaseMigrationGenerate();
    const generator = createGenerator([
      {
        class: WorkspaceMember,
        tableName: "workspace_member",
      },
    ]);

    const [file] = await generator.generate(WORKSPACE_MEMBER_FIELD_CHANGE_DIFF);

    expect(superGenerate).toHaveBeenCalledWith(
      WORKSPACE_MEMBER_FIELD_CHANGE_DIFF,
      undefined,
      undefined,
    );
    expect(file).toContain(
      "import { Migration } from '@mikro-orm/migrations';",
    );
    expect(file).toContain("extends Migration");
    expect(file).not.toContain("workspace_member_user_select_policy");
  });

  it("does not recreate unchanged policies when database expressions are deparsed", async () => {
    const execute = createExistingPolicyLookup(
      "(( SELECT (current_setting('app.user_id'::text, true))::bigint AS current_setting) = user_id)",
    );
    const superGenerate = mockBaseMigrationGenerate();
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

    const [file] = await generator.generate(WORKSPACE_MEMBER_FIELD_CHANGE_DIFF);

    expect(superGenerate).toHaveBeenCalledWith(
      WORKSPACE_MEMBER_FIELD_CHANGE_DIFF,
      undefined,
      undefined,
    );
    expect(file).toContain(
      "import { Migration } from '@mikro-orm/migrations';",
    );
    expect(file).toContain("extends Migration");
    expect(file).not.toContain("workspace_member_user_select_policy");
  });

  it("does not recreate unchanged generated policies with legacy PostgreSQL-truncated names", async () => {
    const execute = jest.fn((_sql: string) =>
      Promise.resolve([
        {
          policy_name: LONG_GENERATED_POLICY_NAME_POSTGRES_TRUNCATED,
          schema_name: "public",
          table_name: "workspace_member_group_member",
          permissive: true,
          command: "*",
          qual: "(( SELECT (current_setting('app.workspace_id'::text, true))::bigint AS current_setting) = workspace_id)",
          with_check:
            "(( SELECT (current_setting('app.workspace_id'::text, true))::bigint AS current_setting) = workspace_id)",
          roles: ["authenticated"],
        },
      ]),
    );
    const generator = createGenerator(
      [
        {
          class: WorkspaceMemberGroupMemberWithLongGeneratedPolicy,
          tableName: "workspace_member_group_member",
          properties: {
            workspace: {
              fieldNames: ["workspace_id"],
              columnTypes: ["bigint"],
            },
          },
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
    );

    mockBaseMigrationGenerate(WORKSPACE_MEMBER_GROUP_MEMBER_FIELD_CHANGE_DIFF);

    const [file] = await generator.generate(
      WORKSPACE_MEMBER_GROUP_MEMBER_FIELD_CHANGE_DIFF,
    );

    expect(file).toContain(
      'alter table "workspace_member_group_member" add column "display_name" text null;',
    );
    expect(file).toContain("extends Migration");
    expect(file).not.toContain(LONG_GENERATED_POLICY_NAME_POSTGRES_TRUNCATED);
    expect(file).not.toContain(LONG_GENERATED_POLICY_NAME);
    expect(file).not.toContain(LONG_GENERATED_POLICY_NAME_SHORTENED);
  });

  it.each([
    [
      "deparsed-style context setting call",
      `(select current_setting('app.user_id'::text, true)::bigint) = user_id`,
      "(( SELECT current_setting('app.user_id'::text, true)::bigint) = user_id)",
    ],
    [
      "integer alias and non-keyword identifier quotes",
      `((select current_setting('app.workspace_id', true)::integer) = "workspace_id")`,
      "(( SELECT current_setting('app.workspace_id'::text, true)::integer) = workspace_id)",
    ],
    [
      "PostgreSQL keyword identifier quotes",
      `((select current_setting('app.order_id', true)::integer) = "order")`,
      `(( SELECT current_setting('app.order_id'::text, true)::integer) = "order")`,
    ],
    [
      "keyword casing and string literal casts",
      `("status" = 'SELECT'::text AND NOT false)`,
      "(status = 'SELECT' and not false)",
    ],
    [
      "JSON extraction operator spacing",
      `claims->>'tenant_id' = 'acme'`,
      `((claims ->> 'tenant_id'::text) = 'acme'::text)`,
    ],
    [
      "varchar context type alias",
      `((select current_setting('app.tenant_id', true)::character varying) = "tenant_id")`,
      "(( SELECT current_setting('app.tenant_id'::text, true)::character varying) = tenant_id)",
    ],
    [
      "timestamptz context type alias",
      `((select current_setting('app.expires_at', true)::timestamp with time zone) > expires_at)`,
      "(( SELECT current_setting('app.expires_at'::text, true)::timestamp with time zone) > expires_at)",
    ],
    [
      "PostgreSQL canonical not-equals operator",
      `status != 'deleted'`,
      `(status <> 'deleted'::text)`,
    ],
  ])(
    "does not recreate unchanged explicit policies with %s",
    async (_name, using, databaseQual) => {
      @Policy({
        name: "workspace_member_user_select_policy",
        command: PolicyCommand.SELECT,
        using,
      })
      class WorkspaceMemberWithExplicitPolicy {}

      const file = await generateFieldChangeMigrationFile(
        WorkspaceMemberWithExplicitPolicy,
        databaseQual,
      );

      expect(file).not.toContain("workspace_member_user_select_policy");
    },
  );

  it.each([
    ["quoted identifier case changes", `"SELECT" = true`, `"select" = true`],
    [
      "cast target type changes",
      `cast(user_id as integer) = 1`,
      `cast(user_id as bigint) = 1`,
    ],
  ])(
    "recreates changed explicit policies when %s",
    async (_name, using, databaseQual) => {
      @Policy({
        name: "workspace_member_user_select_policy",
        command: PolicyCommand.SELECT,
        using,
      })
      class WorkspaceMemberWithChangedExplicitPolicy {}

      const file = await generateFieldChangeMigrationFile(
        WorkspaceMemberWithChangedExplicitPolicy,
        databaseQual,
      );

      expect(file).toContain("workspace_member_user_select_policy");
    },
  );

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

  it("only diffs existing database policies for tables managed by Policy metadata", async () => {
    const execute = jest.fn((_sql: string) =>
      Promise.resolve([
        {
          policy_name: "unmanaged_policy",
          schema_name: "public",
          table_name: "unmanaged_entity",
          permissive: true,
          command: "r",
          qual: "true",
          with_check: null,
          roles: ["authenticated"],
        },
      ]),
    );
    jest
      .spyOn(TSMigrationGenerator.prototype, "generate")
      .mockImplementation(function (this: RowLevelSecurityMigrationGenerator) {
        expect((this as any).existingPolicyDefinitions).toEqual([]);
        expect((this as any).existingPolicyRoleDefinitions).toEqual([
          expect.objectContaining({
            policyName: "unmanaged_policy",
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

    expect(execute.mock.calls[0]?.[0]).toContain("FROM pg_policy");
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
    expect(file).not.toContain("create schema if not exists app");
    expect(file).not.toContain("grant usage on schema app");
    expect(file).not.toContain("create role anonymous");
    expect(file).not.toContain("grant anonymous to current_user");
    expect(file).not.toContain("app.get_context");
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
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select current_setting(\'app.user_id\', true)::bigint) = "user_id");`);',
    );
  });

  it("grants policy privileges for custom policy roles without role bootstrap SQL", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithCustomRole,
        tableName: "workspace_member",
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).not.toContain("grant usage on schema app");
    expect(file).not.toContain("create role anonymous");
    expect(file).not.toContain("create role workspace_admin");
    expect(file).not.toContain("grant anonymous to current_user");
    expect(file).not.toContain("grant workspace_admin to current_user");
    expect(file).toContain(
      'this.addSql(`grant select on table "public"."workspace_member" to workspace_admin;`);',
    );
    expect(file).toContain(
      'this.addSql(`revoke select on table "public"."workspace_member" from workspace_admin;`);',
    );
    expect(file).not.toContain("revoke usage on schema app");
    expect(file).not.toContain("revoke workspace_admin from current_user");
    expect(file).not.toContain("drop role workspace_admin");
  });

  it("keeps grants required by pre-existing policies when rolling back added policies", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithSharedRolePolicies,
        tableName: "workspace_member",
      },
    ]);
    (generator as any).existingPolicyDefinitions = [
      {
        entityName: "WorkspaceMemberWithSharedRolePolicies",
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_admin_select_policy",
        command: PolicyCommand.SELECT,
        using: "true",
        roles: ["workspace_admin"],
      },
    ];

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      "drop policy if exists workspace_member_admin_update_policy",
    );
    expect(file).toContain(
      'this.addSql(`revoke update on table "public"."workspace_member" from workspace_admin;`);',
    );
    expect(file).not.toContain(
      'this.addSql(`revoke select, update on table "public"."workspace_member" from workspace_admin;`);',
    );
    expect(file).not.toContain(
      "this.addSql(`revoke usage on schema app from anonymous;`);",
    );
    expect(file).not.toContain(
      "this.addSql(`revoke anonymous from current_user;`);",
    );
    expect(file).not.toContain(
      "this.addSql(`revoke usage on schema app from workspace_admin;`);",
    );
    expect(file).not.toContain(
      "this.addSql(`revoke workspace_admin from current_user;`);",
    );
  });

  it("keeps schema grants required by policies outside the generated diff", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithCustomRole,
        tableName: "workspace_member",
      },
    ]);
    (generator as any).existingPolicyDefinitions = [];
    (generator as any).existingPolicyRoleDefinitions = [
      {
        entityName: "ExternalPolicy",
        schemaName: "external",
        tableName: "workspace",
        policyName: "external_workspace_policy",
        command: PolicyCommand.SELECT,
        using: "true",
        roles: ["workspace_admin"],
      },
    ];

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      'this.addSql(`revoke select on table "public"."workspace_member" from workspace_admin;`);',
    );
    expect(file).not.toContain(
      "this.addSql(`revoke usage on schema app from workspace_admin;`);",
    );
    expect(file).not.toContain(
      "this.addSql(`revoke workspace_admin from current_user;`);",
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
    expect(file).toContain("for select to authenticated using (true)");
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
      "using ((select current_setting('app.user_id', true)::bigint) = \"user_id\")",
    );
    expect(file).toContain("for select to authenticated using (false)");
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
      'this.addSql(`create policy audit_log_select_policy on "app"."audit_log" as permissive for select using (true);`);',
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
      'this.addSql(`create policy workspace_member_write_policy on "public"."workspace_member" as permissive for all using ((select current_setting(\'app.workspace_id\', true)::bigint) = "workspace_id") with check ((select current_setting(\'app.workspace_id\', true)::bigint) = "workspace_id");`);',
    );
    expect(file).toContain(
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select current_setting(\'app.user_id\', true)::bigint) = "user_id");`);',
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
      'this.addSql(`create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select current_setting(\'app.user_id\', true)::bigint) = user_id);`);',
    );
  });

  it("shortens generated policy names longer than PostgreSQL identifier limit", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberGroupMemberWithLongGeneratedPolicy,
        tableName: "workspace_member_group_member",
        properties: {
          workspace: {
            fieldNames: ["workspace_id"],
            columnTypes: ["bigint"],
          },
        },
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(LONG_GENERATED_POLICY_NAME_SHORTENED).toHaveLength(62);
    expect(file).toContain(
      `create policy ${LONG_GENERATED_POLICY_NAME_SHORTENED}`,
    );
    expect(file).toContain(
      `drop policy if exists ${LONG_GENERATED_POLICY_NAME_SHORTENED}`,
    );
    expect(file).not.toContain(LONG_GENERATED_POLICY_NAME);
  });

  it("canonicalizes generated policy context type aliases", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithWorkspaceContextPolicy,
        tableName: "workspace_member",
        properties: {
          workspace: {
            fieldNames: ["workspace_id"],
            columnTypes: ["int"],
          },
        },
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      "current_setting('app.workspace_id', true)::integer",
    );
  });

  it("preserves quoted PostgreSQL keyword column names in generated policies", () => {
    const generator = createGenerator([
      {
        class: WorkspaceMemberWithWorkspaceContextPolicy,
        tableName: "workspace_member",
        properties: {
          workspace: {
            fieldNames: ["between"],
            columnTypes: ["integer"],
          },
        },
      },
    ]);

    const file = generator.generateMigrationFile("MigrationTest", {
      up: [],
      down: [],
    });

    expect(file).toContain(
      `using ((select current_setting('app.workspace_id', true)::integer) = "between")`,
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

describe("RowLevelSecurityMigrator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a migration when only row-level-security policies changed", async () => {
    const diff = { up: [], down: [] };
    const generator = createGenerator([]);
    const hasPendingPolicyChanges = jest
      .spyOn(generator, "hasPendingPolicyChanges")
      .mockResolvedValue(true);
    const generate = jest
      .spyOn(generator, "generate")
      .mockResolvedValue(["migration-file", "Migration.ts"]);
    const storeCurrentSchema = jest.fn();
    const migrator = Object.assign(
      Object.create(RowLevelSecurityMigrator.prototype),
      {
        generator,
        ensureMigrationsDirExists: jest.fn(),
        getSchemaDiff: jest.fn().mockResolvedValue(diff),
        storeCurrentSchema,
      },
    ) as RowLevelSecurityMigrator;

    await expect(
      migrator.createMigration("/tmp", false, false, "Migration"),
    ).resolves.toEqual({
      fileName: "Migration.ts",
      code: "migration-file",
      diff,
    });
    expect(hasPendingPolicyChanges).toHaveBeenCalledWith(diff);
    expect(generate).toHaveBeenCalledWith(diff, "/tmp", "Migration");
    expect(storeCurrentSchema).toHaveBeenCalledTimes(1);
  });

  it("generates a policy diff after an applied context policy changes", async () => {
    const migrationPath = mkdtempSync(join(tmpdir(), "rls-policy-diff-"));
    const diff = { up: [], down: [] };
    const execute = jest.fn((_sql: string) =>
      Promise.resolve([
        {
          policy_name: "workspace_member_workspace_select_policy",
          schema_name: "public",
          table_name: "workspace_member",
          permissive: true,
          command: "r",
          qual: "(( SELECT current_setting('app.tenant_id'::text, true)::bigint) = workspace_id)",
          with_check: null,
          roles: ["authenticated"],
        },
      ]),
    );
    const generator = createGenerator(
      [
        {
          class: WorkspaceMemberWithWorkspaceContextPolicy,
          tableName: "workspace_member",
          properties: {
            workspace: {
              fieldNames: ["workspace_id"],
              columnTypes: ["bigint"],
            },
          },
        },
      ],
      {
        getConnection: () => ({
          execute,
        }),
      },
      {
        path: migrationPath,
        pathTs: migrationPath,
      },
    );
    const storeCurrentSchema = jest.fn();
    const migrator = Object.assign(
      Object.create(RowLevelSecurityMigrator.prototype),
      {
        generator,
        ensureMigrationsDirExists: jest.fn(),
        getSchemaDiff: jest.fn().mockResolvedValue(diff),
        storeCurrentSchema,
      },
    ) as RowLevelSecurityMigrator;

    try {
      const result = await migrator.createMigration(
        migrationPath,
        false,
        false,
        "MigrationPolicyContextDiff",
      );

      expect(result.fileName).toBe("MigrationPolicyContextDiff.ts");
      expect(result.diff).toBe(diff);
      expect(result.code).toContain("extends RowLevelSecurityMigration");
      expect(result.code).toContain(
        "drop policy if exists workspace_member_workspace_select_policy",
      );
      expect(result.code).toContain(
        "current_setting('app.workspace_id', true)::bigint",
      );
      expect(result.code).toContain(
        "current_setting('app.tenant_id'::text, true)::bigint",
      );
      expect(
        result.code.indexOf(
          "drop policy if exists workspace_member_workspace_select_policy",
        ),
      ).toBeLessThan(
        result.code.indexOf(
          "create policy workspace_member_workspace_select_policy",
        ),
      );
      expect(storeCurrentSchema).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(migrationPath, { force: true, recursive: true });
    }
  });

  it("keeps MikroORM no-op behavior when schema and policies are unchanged", async () => {
    const diff = { up: [], down: [] };
    const generator = createGenerator([]);
    jest.spyOn(generator, "hasPendingPolicyChanges").mockResolvedValue(false);
    const generate = jest.spyOn(generator, "generate");
    const storeCurrentSchema = jest.fn();
    const migrator = Object.assign(
      Object.create(RowLevelSecurityMigrator.prototype),
      {
        generator,
        ensureMigrationsDirExists: jest.fn(),
        getSchemaDiff: jest.fn().mockResolvedValue(diff),
        storeCurrentSchema,
      },
    ) as RowLevelSecurityMigrator;

    await expect(migrator.createMigration()).resolves.toEqual({
      fileName: "",
      code: "",
      diff,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(storeCurrentSchema).not.toHaveBeenCalled();
  });

  it("reports migration needed when only row-level-security policies changed", async () => {
    const diff = { up: [], down: [] };
    const generator = createGenerator([]);
    jest.spyOn(generator, "hasPendingPolicyChanges").mockResolvedValue(true);
    const migrator = Object.assign(
      Object.create(RowLevelSecurityMigrator.prototype),
      {
        generator,
        ensureMigrationsDirExists: jest.fn(),
        getSchemaDiff: jest.fn().mockResolvedValue(diff),
      },
    ) as RowLevelSecurityMigrator;

    await expect(migrator.checkMigrationNeeded()).resolves.toBe(true);
  });
});

function createGenerator(
  metadata: object[],
  driverOptions: Record<string, unknown> = {},
  generatorOptions: Record<string, unknown> = {},
) {
  return new RowLevelSecurityMigrationGenerator(
    {
      config: {
        get: (key: string) => (key === "baseDir" ? process.cwd() : undefined),
        getMetadata: () => ({
          getAll: () => metadata,
        }),
      },
      ...driverOptions,
    } as never,
    {
      classToMigrationName: (_timestamp: string, name?: string) =>
        name ?? "Migration",
    } as never,
    {
      emit: "ts",
      fileName: (_timestamp: string, name?: string) => name ?? "Migration",
      ...generatorOptions,
    } as never,
  );
}

function mockBaseMigrationGenerate(diff = WORKSPACE_MEMBER_FIELD_CHANGE_DIFF) {
  return jest
    .spyOn(TSMigrationGenerator.prototype, "generate")
    .mockImplementation(function (this: RowLevelSecurityMigrationGenerator) {
      return Promise.resolve([
        this.generateMigrationFile("MigrationTest", diff),
        "/tmp/Migration.ts",
      ]);
    });
}

function createExistingPolicyLookup(databaseQual: string) {
  return jest.fn((_sql: string) =>
    Promise.resolve([
      {
        policy_name: "workspace_member_user_select_policy",
        schema_name: "public",
        table_name: "workspace_member",
        permissive: true,
        command: "r",
        qual: databaseQual,
        with_check: null,
        roles: [],
      },
    ]),
  );
}

async function generateFieldChangeMigrationFile(
  policyClass: object,
  databaseQual: string,
) {
  const execute = createExistingPolicyLookup(databaseQual);
  const generator = createGenerator(
    [
      {
        class: policyClass,
        tableName: "workspace_member",
      },
    ],
    {
      getConnection: () => ({
        execute,
      }),
    },
  );

  mockBaseMigrationGenerate();

  const [file] = await generator.generate(WORKSPACE_MEMBER_FIELD_CHANGE_DIFF);

  return file;
}
