import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";
import {
  getPolicyDefinitions,
  getPolicyMetadata,
  Policy,
} from "./policy.decorator";

describe("Policy decorator", () => {
  it("stores RLS policy metadata on the entity class", () => {
    @Policy({
      name: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
    })
    class WorkspaceMember {}

    expect(getPolicyMetadata(WorkspaceMember)).toEqual([
      {
        name: "workspace_member_user_select_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.SELECT,
        using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
        roles: [],
      },
    ]);
  });

  it("keeps multiple policies in declaration order", () => {
    @Policy({
      name: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
    })
    @Policy({
      name: "tenant_access_policy",
      command: PolicyCommand.ALL,
      using: `((select app.get_context('tenant_id', null::bigint)) = "workspace_id")`,
      withCheck: `((select app.get_context('tenant_id', null::bigint)) = "workspace_id")`,
    })
    class WorkspaceMember {}

    expect(
      getPolicyMetadata(WorkspaceMember).map((policy) => policy.name),
    ).toEqual(["tenant_access_policy", "workspace_member_user_select_policy"]);
  });

  it("stores restrictive policy mode", () => {
    @Policy({
      name: "tenant_required_policy",
      mode: PolicyMode.RESTRICTIVE,
      using: `((select app.get_context('tenant_id', null::bigint)) is not null)`,
    })
    class WorkspaceMember {}

    expect(getPolicyMetadata(WorkspaceMember)[0]).toMatchObject({
      name: "tenant_required_policy",
      mode: PolicyMode.RESTRICTIVE,
      command: PolicyCommand.ALL,
    });
  });

  it("generates policy expressions from property and context", () => {
    @Policy({
      name: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      property: "user",
      context: "user_id",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
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
      }),
    ).toEqual([
      {
        name: "workspace_member_user_select_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.SELECT,
        using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
        roles: [],
      },
    ]);
  });

  it("generates a default policy name from table, property, and command", () => {
    @Policy({
      command: PolicyCommand.SELECT,
      property: "user",
      context: "user_id",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["bigint"],
          },
        },
      }),
    ).toEqual([
      {
        name: "workspace_member_user_select_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.SELECT,
        using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
        roles: [],
      },
    ]);
  });

  it("generates a default policy name without a property", () => {
    @Policy({
      command: PolicyCommand.SELECT,
      using: "true",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
      }),
    ).toEqual([
      {
        name: "workspace_member_select_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.SELECT,
        using: "true",
        roles: [],
      },
    ]);
  });

  it("uses explicit predicates over generated property context expressions", () => {
    @Policy({
      name: "workspace_member_write_policy",
      property: "workspace",
      context: "tenant_id",
      using: "true",
      withCheck: "false",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          workspace: {
            fieldNames: ["workspace_id"],
            columnTypes: ["bigint"],
          },
        },
      }),
    ).toEqual([
      {
        name: "workspace_member_write_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.ALL,
        using: "true",
        withCheck: "false",
        roles: [],
      },
    ]);
  });

  it("sorts roles in generated policy names", () => {
    @Policy({
      command: PolicyCommand.SELECT,
      property: "user",
      context: "user_id",
      roles: ["memberRole", "adminRole"],
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["bigint"],
          },
        },
      })[0],
    ).toMatchObject({
      name: "workspace_member_user_select_admin_role_member_role_policy",
      roles: ["memberRole", "adminRole"],
    });
  });

  it("generates insert predicates from property and context", () => {
    @Policy({
      command: PolicyCommand.INSERT,
      property: "user",
      context: "user_id",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["bigint"],
          },
        },
      }),
    ).toEqual([
      {
        name: "workspace_member_user_insert_policy",
        mode: PolicyMode.PERMISSIVE,
        command: PolicyCommand.INSERT,
        withCheck: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
        roles: [],
      },
    ]);
  });

  it("generates all-command predicates from property and context", () => {
    @Policy({
      property: "workspace",
      context: "tenant_id",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          workspace: {
            fieldNames: ["workspace_id"],
            runtimeType: "number",
          },
        },
      })[0],
    ).toMatchObject({
      name: "workspace_member_workspace_all_policy",
      using: `((select app.get_context('tenant_id', null::integer)) = "workspace_id")`,
      withCheck: `((select app.get_context('tenant_id', null::integer)) = "workspace_id")`,
    });
  });

  it.each([
    ["bigint", "bigint"],
    ["boolean", "boolean"],
    ["Date", "timestamp with time zone"],
    ["text", "text"],
    ["uuid", "uuid"],
  ])("maps %s property types to policy context types", (type, postgresType) => {
    @Policy({
      command: PolicyCommand.SELECT,
      property: "contextValue",
      context: "context_value",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          contextValue: {
            fieldName: "context_value",
            type,
          },
        },
      })[0],
    ).toMatchObject({
      using: `((select app.get_context('context_value', null::${postgresType})) = "context_value")`,
    });
  });

  it("infers target primary key metadata from a primary property marker", () => {
    @Policy({
      command: PolicyCommand.SELECT,
      property: "user",
      context: "user_id",
    })
    class WorkspaceMember {}

    expect(
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        properties: {
          user: {
            fieldNames: ["user_id"],
            targetMeta: {
              properties: {
                id: {
                  primary: true,
                  runtimeType: "uuid",
                },
              },
            },
          },
        },
      })[0],
    ).toMatchObject({
      using: `((select app.get_context('user_id', null::uuid)) = "user_id")`,
    });
  });

  it("rejects an empty policy name when provided", () => {
    expect(() =>
      Policy({
        name: "",
        using: `((select app.get_context('tenant_id', null::bigint)) = "workspace_id")`,
      }),
    ).toThrow("Policy name is required");
  });

  it("rejects a select policy without using", () => {
    expect(() =>
      Policy({
        name: "tenant_access_policy",
        command: PolicyCommand.SELECT,
      }),
    ).toThrow("Policy using expression is required");
  });

  it("requires property and context to be provided together", () => {
    expect(() =>
      Policy({
        name: "tenant_access_policy",
        property: "workspace",
      }),
    ).toThrow("Policy property and context must be provided together");
  });

  it("rejects a select policy with withCheck", () => {
    expect(() =>
      Policy({
        name: "tenant_access_policy",
        command: PolicyCommand.SELECT,
        using: `((select app.get_context('tenant_id', null::bigint)) = "workspace_id")`,
        withCheck: `((select app.get_context('tenant_id', null::bigint)) = "workspace_id")`,
      }),
    ).toThrow("Policy withCheck is not allowed for select");
  });

  it.each([
    [
      "insert policy with using",
      () =>
        Policy({
          command: PolicyCommand.INSERT,
          using: "true",
          withCheck: "true",
        }),
      "Policy using is not allowed for insert",
    ],
    [
      "insert policy without withCheck",
      () =>
        Policy({
          command: PolicyCommand.INSERT,
        }),
      "Policy withCheck expression is required",
    ],
    [
      "all policy without predicates",
      () =>
        Policy({
          name: "workspace_member_all_policy",
        }),
      "Policy using or withCheck expression is required",
    ],
  ])("rejects %s", (_name, createPolicy, message) => {
    expect(createPolicy).toThrow(message);
  });

  it.each([
    [
      "missing property metadata",
      {
        properties: {},
      },
      `Policy property "user" was not found on entity WorkspaceMember`,
    ],
    [
      "multiple column names",
      {
        properties: {
          user: {
            fieldNames: ["user_id", "tenant_id"],
            columnTypes: ["bigint"],
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember must resolve to exactly one database column`,
    ],
    [
      "target with multiple primary keys",
      {
        properties: {
          user: {
            fieldNames: ["user_id"],
            targetMeta: {
              primaryKeys: ["id", "tenantId"],
              properties: {
                id: {
                  columnTypes: ["bigint"],
                },
                tenantId: {
                  columnTypes: ["bigint"],
                },
              },
            },
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember must target an entity with exactly one primary key`,
    ],
    [
      "target without primary key metadata",
      {
        properties: {
          user: {
            fieldNames: ["user_id"],
            targetMeta: {
              primaryKeys: ["id"],
              properties: {},
            },
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember must expose target primary key metadata`,
    ],
    [
      "multiple column types",
      {
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["bigint", "uuid"],
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember must resolve to exactly one database column type`,
    ],
    [
      "unsupported database column type",
      {
        properties: {
          user: {
            fieldNames: ["user_id"],
            columnTypes: ["bigint; drop table users"],
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember has an unsupported database column type: bigint; drop table users`,
    ],
    [
      "missing database column type",
      {
        properties: {
          user: {
            fieldNames: ["user_id"],
            type: "unknown",
          },
        },
      },
      `Policy property "user" on entity WorkspaceMember must expose a database column type`,
    ],
  ])("rejects generated policy for %s", (_name, metadata, message) => {
    @Policy({
      command: PolicyCommand.SELECT,
      property: "user",
      context: "user_id",
    })
    class WorkspaceMember {}

    expect(() =>
      getPolicyDefinitions(WorkspaceMember, {
        entityName: "WorkspaceMember",
        schemaName: "public",
        tableName: "workspace_member",
        ...metadata,
      }),
    ).toThrow(message);
  });
});
