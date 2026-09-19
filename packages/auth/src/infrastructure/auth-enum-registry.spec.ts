import {
  Args,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import {
  getVariableValues,
  type GraphQLEnumType,
  type GraphQLSchema,
  Kind,
  parse,
} from "graphql";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  UserApiKeyPermission,
  UserPermission,
  UserRole,
  WorkspaceApiKeyPermission,
  WorkspacePermission,
  WorkspaceRole,
} from "../enums/index.js";
import { DEFAULT_USER_PERMISSIONS } from "../user.constants.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";
import { AuthEnumRegistry } from "./auth-enum-registry.js";

@Resolver()
class EnumTestResolver {
  @Query(() => [WorkspaceApiKeyPermission])
  workspaceApiKeyPermissions(): string[] {
    return [];
  }
  @Query(() => UserRole)
  userRole(@Args("role", { type: () => UserRole }) role: string): string {
    return role;
  }
  @Query(() => WorkspaceRole)
  workspaceRole(): string {
    return "owner";
  }
  @Query(() => [UserPermission])
  userPermissions(): string[] {
    return [];
  }
  @Query(() => [WorkspacePermission])
  workspacePermissions(): string[] {
    return [];
  }
  @Query(() => [UserApiKeyPermission])
  apiKeyPermissions(
    @Args("permissions", { type: () => [UserApiKeyPermission] })
    permissions: string[],
  ): string[] {
    return permissions;
  }
}

describe("auth enum registration", () => {
  const registrations: AuthEnumRegistry[] = [];
  const register = (options: AuthModuleOptions) => {
    const registry = new AuthEnumRegistry(options);
    registrations.push(registry);
    return registry;
  };
  afterEach(() => {
    registrations.splice(0).forEach((registry) => {
      registry.onModuleDestroy();
    });
  });
  const buildSchema = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    try {
      return await moduleRef
        .get(GraphQLSchemaFactory)
        .create([EnumTestResolver]);
    } finally {
      await moduleRef.close();
    }
  };
  const enumType = (schema: GraphQLSchema, name: string) =>
    schema.getType(name) as GraphQLEnumType;

  it("keeps stored API-key grants serializable after tightening the allowlist", async () => {
    register({
      user: { permissions: ["user:read"] },
      workspace: { permissions: ["project:read", "project:write"] },
      apiKey: { allowedPermissions: ["user:read", "project:read"] },
    });
    const schema = await buildSchema();
    expect(
      enumType(schema, "UserApiKeyPermission")
        .getValues()
        .map(({ value }) => value),
    ).toEqual([
      ...DEFAULT_USER_PERMISSIONS,
      "user:read",
      ...DEFAULT_WORKSPACE_PERMISSIONS.filter(
        (value) => !value.startsWith("api-key:"),
      ),
      "project:read",
      "project:write",
    ]);
    const workspace = enumType(schema, "WorkspaceApiKeyPermission");
    expect(workspace.getValues().map(({ value }) => value)).toEqual([
      ...DEFAULT_WORKSPACE_PERMISSIONS,
      "project:read",
      "project:write",
    ]);
    expect(() => workspace.parseValue("USER__READ")).toThrow();
    expect(workspace.serialize("project:write")).toBe("PROJECT__WRITE");
    expect(
      enumType(schema, "UserApiKeyPermission").serialize("project:write"),
    ).toBe("PROJECT__WRITE");
  });

  it("uses the full scope catalog for empty API-key enum configuration", async () => {
    register({
      user: { permissions: ["user:read"] },
      workspace: { permissions: ["project:read"] },
      apiKey: { allowedPermissions: [] },
    });
    const schema = await buildSchema();
    expect(
      enumType(schema, "UserApiKeyPermission")
        .getValues()
        .map(({ value }) => value),
    ).toEqual([
      ...DEFAULT_USER_PERMISSIONS,
      "user:read",
      ...DEFAULT_WORKSPACE_PERMISSIONS.filter(
        (value) => !value.startsWith("api-key:"),
      ),
      "project:read",
    ]);
    expect(
      enumType(schema, "WorkspaceApiKeyPermission")
        .getValues()
        .map(({ value }) => value),
    ).toEqual([...DEFAULT_WORKSPACE_PERMISSIONS, "project:read"]);
  });

  it("builds configured roles and scope-specific API-key permissions", async () => {
    register({
      user: {
        roles: { "super-admin": [] },
        permissions: ["user:read", "api-key:read"],
      },
      workspace: {
        roles: { "team-owner": [] },
        permissions: ["project:write"],
      },
      apiKey: { allowedPermissions: ["api-key:read"] },
    });
    const schema = await buildSchema();
    const userRole = enumType(schema, "UserRole");
    expect(
      userRole.getValues().map(({ name, value }) => [name, value]),
    ).toEqual([
      ["ADMIN", "admin"],
      ["USER", "user"],
      ["SUPER_ADMIN", "super-admin"],
    ]);
    expect(userRole.parseValue("SUPER_ADMIN")).toBe("super-admin");
    expect(userRole.serialize("super-admin")).toBe("SUPER_ADMIN");
    expect(() => userRole.parseValue("super-admin")).toThrow();
    expect(enumType(schema, "WorkspaceRole").parseValue("TEAM_OWNER")).toBe(
      "team-owner",
    );
    const apiKey = enumType(schema, "UserApiKeyPermission");
    expect(apiKey.getValues().map(({ name, value }) => [name, value])).toEqual([
      ...DEFAULT_USER_PERMISSIONS.map((value) => [
        value.toUpperCase().replaceAll(":", "__").replaceAll("-", "_"),
        value,
      ]),
      ["USER__READ", "user:read"],
      ...DEFAULT_WORKSPACE_PERMISSIONS.filter(
        (value) => !value.startsWith("api-key:"),
      ).map((value) => [
        value.toUpperCase().replaceAll(":", "__").replaceAll("-", "_"),
        value,
      ]),
      ["PROJECT__WRITE", "project:write"],
    ]);
    expect(apiKey.serialize("api-key:read")).toBe("API_KEY__READ");
    expect(apiKey.parseValue("USER__READ")).toBe("user:read");
    expect(() => apiKey.parseValue("api-key:read")).toThrow();
    const document = parse(
      "query($role: UserRole!, $permissions: [UserApiKeyPermission!]!) { userRole(role: $role) apiKeyPermissions(permissions: $permissions) }",
    );
    const operation = document.definitions[0];
    if (operation.kind !== Kind.OPERATION_DEFINITION)
      throw new Error("Missing operation");
    expect(
      getVariableValues(schema, operation.variableDefinitions ?? [], {
        role: "SUPER_ADMIN",
        permissions: ["API_KEY__READ"],
      }),
    ).toEqual({
      coerced: { role: "super-admin", permissions: ["api-key:read"] },
    });
  });

  it.each(["user", "workspace"] as const)(
    "keeps built-in enums when %s permission additions are empty",
    async (scope) => {
      register({ [scope]: { permissions: [] } });
      register({});
      const schema = await buildSchema();
      expect(enumType(schema, "UserPermission").parseValue("USER__GET")).toBe(
        "user:get",
      );
    },
  );

  it("rejects conflicting live registrations and releases them on shutdown", async () => {
    const first = register({});
    const duplicate = register({});
    const schema = await buildSchema();
    const changed = { user: { roles: { reader: [] } } };
    expect(() => register(changed)).toThrow("Concurrent AuthModule");
    first.onModuleDestroy();
    first.onModuleDestroy();
    expect(() => register(changed)).toThrow("Concurrent AuthModule");
    duplicate.onModuleDestroy();
    register(changed);
    expect(enumType(await buildSchema(), "UserRole").parseValue("READER")).toBe(
      "reader",
    );
    expect(
      enumType(schema, "UserRole")
        .getValues()
        .map(({ name }) => name),
    ).toEqual(["ADMIN", "USER"]);
  });

  it("rejects mapping collisions before changing registered metadata", () => {
    register({});
    expect(() =>
      register({ user: { permissions: ["api-key:read", "api_key:read"] } }),
    ).toThrow("Permission enum collision");
    expect(UserPermission.USER__GET).toBe("user:get");
  });
});
