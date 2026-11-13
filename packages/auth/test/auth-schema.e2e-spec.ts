import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLInputObjectType, GraphQLObjectType } from "graphql";

import { AdminSessionResolver } from "../src/admin/resolvers/admin-session.resolver.js";
import { AdminUserResolver } from "../src/admin/resolvers/admin-user.resolver.js";
import { SystemAccountResolver } from "../src/admin/resolvers/system-account.resolver.js";
import { SystemApiKeyResolver } from "../src/api-key/resolvers/system-api-key.resolver.js";
import { SystemApiKeyRelationResolver } from "../src/api-key/resolvers/system-api-key-relation.resolver.js";
import { UserApiKeyResolver } from "../src/api-key/resolvers/user-api-key.resolver.js";
import { UserApiKeyRelationResolver } from "../src/api-key/resolvers/user-api-key-relation.resolver.js";
import { WorkspaceApiKeyResolver } from "../src/api-key/resolvers/workspace-api-key.resolver.js";
import { WorkspaceApiKeyConnectionResolver } from "../src/api-key/resolvers/workspace-api-key-connection.resolver.js";
import { WorkspaceApiKeyRelationResolver } from "../src/api-key/resolvers/workspace-api-key-relation.resolver.js";
import { AuthEnumRegistry } from "../src/core/auth-enum-registry.js";
import { AuthResolver } from "../src/core/resolvers/auth.resolver.js";
import { SessionResolver } from "../src/core/resolvers/session.resolver.js";
import { UserResolver } from "../src/core/resolvers/user.resolver.js";
import { UserWorkspaceResolver } from "../src/workspace/resolvers/user-workspace.resolver.js";
import { WorkspaceResolver } from "../src/workspace/resolvers/workspace.resolver.js";
import { WorkspaceInvitationResolver } from "../src/workspace/resolvers/workspace-invitation.resolver.js";
import { WorkspaceMemberResolver } from "../src/workspace/resolvers/workspace-member.resolver.js";

// Filter-scalar execution is covered by the example's real-server e2e tests.
describe("auth GraphQL schema", () => {
  let registry: AuthEnumRegistry;
  afterEach(() => {
    registry?.onModuleDestroy();
  });
  it("builds the built-in schema without application type registration", async () => {
    registry = new AuthEnumRegistry({ workspace: { enabled: true } });
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([
      AuthResolver,
      SystemApiKeyResolver,
      WorkspaceApiKeyConnectionResolver,
      AdminSessionResolver,
      AdminUserResolver,
      UserApiKeyRelationResolver,
      WorkspaceApiKeyRelationResolver,
      SystemApiKeyRelationResolver,
      UserResolver,
      UserWorkspaceResolver,
      SessionResolver,
      WorkspaceResolver,
      WorkspaceMemberResolver,
      UserApiKeyResolver,
      WorkspaceApiKeyResolver,
      WorkspaceInvitationResolver,
      SystemAccountResolver,
    ]);
    expect(schema.getQueryType()?.getFields().authWorkspace).toBeUndefined();
    expect(
      schema.getQueryType()?.getFields().currentWorkspace.type.toString(),
    ).toBe("Workspace");
    expect(schema.getQueryType()?.getFields().currentUser.type.toString()).toBe(
      "User",
    );
    expect(schema.getQueryType()?.getFields().user.type.toString()).toBe(
      "User",
    );
    expect(schema.getMutationType()?.getFields().signUp.type.toString()).toBe(
      "SignUpPayload!",
    );
    const signUpFields = (
      schema.getType("SignUpPayload") as GraphQLObjectType
    ).getFields();
    expect(Object.keys(signUpFields).sort()).toEqual(["id", "token"]);
    expect(signUpFields.id.type.toString()).toBe("ID!");
    expect(signUpFields.token.type.toString()).toBe("String");
    for (const [operation, payload, field] of [
      ["createUser", "CreateUserPayload", "id"],
      ["updateUser", "UpdateUserPayload", "id"],
      ["setUserPermissions", "SetUserPermissionsPayload", "id"],
      ["setUserRoles", "SetUserRolesPayload", "id"],
      ["banUser", "BanUserPayload", "id"],
      ["unbanUser", "UnbanUserPayload", "id"],
      ["createWorkspace", "CreateWorkspacePayload", "id"],
      ["updateWorkspace", "UpdateWorkspacePayload", "id"],
      ["addWorkspaceMember", "AddWorkspaceMemberPayload", "id"],
      ["setWorkspaceMemberRoles", "SetWorkspaceMemberRolesPayload", "id"],
      [
        "setWorkspaceMemberPermissions",
        "SetWorkspaceMemberPermissionsPayload",
        "id",
      ],
      ["createWorkspaceInvitation", "CreateWorkspaceInvitationPayload", "id"],
      ["rejectWorkspaceInvitation", "RejectWorkspaceInvitationPayload", "id"],
      ["cancelWorkspaceInvitation", "CancelWorkspaceInvitationPayload", "id"],
      ["deleteWorkspace", "DeleteWorkspacePayload", "id"],
      ["deleteUser", "DeleteUserPayload", "id"],
      ["removeWorkspaceMember", "RemoveWorkspaceMemberPayload", "id"],
      ["leaveWorkspace", "LeaveWorkspacePayload", "memberId"],
    ]) {
      expect(
        schema.getMutationType()?.getFields()[operation].type.toString(),
      ).toBe(`${payload}!`);
      const fields = (schema.getType(payload) as GraphQLObjectType).getFields();
      expect(Object.keys(fields)).toEqual([field]);
      expect(fields[field].type.toString()).toBe("ID!");
    }
    expect(
      schema
        .getMutationType()
        ?.getFields()
        .updateWorkspaceMember.type.toString(),
    ).toBe("UpdateWorkspaceMemberPayload");
    expect(
      Object.keys(
        (
          schema.getType("UpdateWorkspaceMemberPayload") as GraphQLObjectType
        ).getFields(),
      ),
    ).toEqual(["id"]);
    expect(
      (schema.getType("WorkspaceMember") as GraphQLObjectType)
        .getFields()
        .user.type.toString(),
    ).toBe("User");
    const invitationFields = (
      schema.getType("WorkspaceInvitation") as GraphQLObjectType
    ).getFields();
    expect(invitationFields.inviter.type.toString()).toBe("User!");
    expect(invitationFields.workspace.type.toString()).toBe("Workspace!");
    expect(schema.getQueryType()?.getFields().users.type.toString()).toBe(
      "UserConnection!",
    );
    const queries = schema.getQueryType()?.getFields();
    if (!queries) {
      throw new Error("Query type is missing");
    }
    expect(queries.workspaceMember?.type.toString()).toBe("WorkspaceMember");
    expect(queries.workspaceInvitation?.type.toString()).toBe(
      "WorkspaceInvitation",
    );
    expect(queries.currentWorkspaceMember?.type.toString()).toBe(
      "WorkspaceMember",
    );
    for (const [type, field] of [
      ["Workspace", "invitations"],
      ["User", "invitations"],
    ]) {
      const fields = (schema.getType(type) as GraphQLObjectType).getFields();
      expect(fields[field]?.type.toString()).toBe(
        "WorkspaceInvitationConnection!",
      );
      expect(fields[field]?.args.map(({ name }) => name)).toContain("first");
    }
    for (const type of [
      "UserApiKeyPermissionOption",
      "WorkspaceApiKeyPermissionOption",
    ]) {
      const fields = (schema.getType(type) as GraphQLObjectType).getFields();
      expect(fields.default.type.toString()).toBe("Boolean!");
    }
    for (const [query, type, field, enumName] of [
      ["userRoles", "UserRoleOption", "role", "UserRole"],
      ["workspaceRoles", "WorkspaceRoleOption", "role", "WorkspaceRole"],
      [
        "userPermissions",
        "UserPermissionOption",
        "permission",
        "UserPermission",
      ],
      [
        "workspacePermissions",
        "WorkspacePermissionOption",
        "permission",
        "WorkspacePermission",
      ],
    ]) {
      expect(queries[query].type.toString()).toBe(`[${type}!]!`);
      const fields = (schema.getType(type) as GraphQLObjectType).getFields();
      expect(fields[field].type.toString()).toBe(`${enumName}!`);
      expect(fields.grantable.type.toString()).toBe("Boolean!");
    }
    for (const [type, field, enumName] of [
      ["User", "roles", "UserRole"],
      ["User", "permissions", "UserPermission"],
      ["WorkspaceMember", "roles", "WorkspaceRole"],
      ["WorkspaceMember", "permissions", "WorkspacePermission"],
      ["WorkspaceInvitation", "roles", "WorkspaceRole"],
      ["UserApiKey", "permissions", "UserApiKeyPermission"],
      ["WorkspaceApiKey", "permissions", "WorkspaceApiKeyPermission"],
      ["SystemApiKey", "permissions", "SystemApiKeyPermission"],

      [
        "CreateWorkspaceApiKeyInput",
        "permissions",
        "WorkspaceApiKeyPermission",
      ],
      [
        "UpdateWorkspaceApiKeyInput",
        "permissions",
        "WorkspaceApiKeyPermission",
      ],
      ["CreateUserInput", "roles", "UserRole"],
      ["CreateUserInput", "permissions", "UserPermission"],
      ["CreateWorkspaceInvitationInput", "roles", "WorkspaceRole"],
      ["SetUserRolesInput", "roles", "UserRole"],
      ["SetWorkspaceMemberRolesInput", "roles", "WorkspaceRole"],
      ["SetUserPermissionsInput", "permissions", "UserPermission"],
      [
        "SetWorkspaceMemberPermissionsInput",
        "permissions",
        "WorkspacePermission",
      ],
      ["CreateUserApiKeyInput", "permissions", "UserApiKeyPermission"],
      ["UpdateUserApiKeyInput", "permissions", "UserApiKeyPermission"],
    ]) {
      expect(
        (schema.getType(type) as GraphQLObjectType)
          .getFields()
          [field].type.toString(),
      ).toMatch(new RegExp(`^\\[${enumName}!\\]!?$`));
    }
    expect(queries.currentSession.type.toString()).toBe("Session");
    expect(
      (schema.getType("User") as GraphQLObjectType)
        .getFields()
        .sessions.type.toString(),
    ).toBe("SessionConnection!");
    expect(
      (schema.getType("User") as GraphQLObjectType)
        .getFields()
        .accounts.type.toString(),
    ).toBe("AccountConnection!");
    expect(
      (schema.getType("User") as GraphQLObjectType)
        .getFields()
        .accounts.args.map(({ name }) => name),
    ).toContain("first");
    expect(
      (schema.getType("Session") as GraphQLObjectType).getFields(),
    ).not.toHaveProperty("token");
    for (const [type, field, connection] of [
      ["User", "workspaces", "WorkspaceConnection"],
      ["User", "apiKeys", "UserApiKeyConnection"],
      ["Workspace", "members", "WorkspaceMemberConnection"],
      ["WorkspaceMember", "apiKeys", "WorkspaceApiKeyConnection"],
      ["SystemAccount", "apiKeys", "SystemApiKeyConnection"],
    ]) {
      const resolved = (schema.getType(type) as GraphQLObjectType).getFields()[
        field
      ];
      expect(resolved?.type.toString()).toBe(`${connection}!`);
      expect(resolved?.args.map(({ name }) => name)).toContain("first");
      if (field === "apiKeys") {
        expect(resolved.args.map(({ name }) => name)).toContain("filter");
      }
    }
    for (const [type, keyType] of [
      ["User", "UserApiKey"],
      ["Workspace", "WorkspaceApiKey"],
    ]) {
      const field = (schema.getType(type) as GraphQLObjectType).getFields()
        .apiKey;
      expect(field?.type.toString()).toBe(keyType);
      expect(
        field?.args.map(({ name, type }) => [name, type.toString()]),
      ).toEqual([["id", "ID!"]]);
    }
    const mutations = schema.getMutationType()?.getFields();
    if (!mutations) {
      throw new Error("Mutation type is missing");
    }
    for (const [scope, relation, identity] of [
      ["User", "user", "User"],
      ["Workspace", "member", "WorkspaceMember"],
      ["System", "systemAccount", "SystemAccount"],
    ]) {
      expect(mutations[`create${scope}ApiKey`].type.toString()).toBe(
        `Create${scope}ApiKeyResult!`,
      );
      expect(mutations[`update${scope}ApiKey`].type.toString()).toBe(
        `${scope}ApiKey!`,
      );
      expect(mutations[`delete${scope}ApiKey`].type.toString()).toBe(
        `${scope}ApiKey!`,
      );
      const fields = (
        schema.getType(`${scope}ApiKey`) as GraphQLObjectType
      ).getFields();
      expect(fields[relation].type.toString()).toBe(identity);
      for (const field of [
        "owner",
        "ownerId",
        "ownerType",
        "memberId",
        "workspaceId",
        "systemAccountId",
        "key",
      ]) {
        expect(fields).not.toHaveProperty(field);
      }
    }
    expect(schema.getType("ApiKey")).toBeUndefined();
    expect(schema.getType("ApiKeyOwner")).toBeUndefined();
    expect(queries.workspaceApiKeys.type.toString()).toBe(
      "WorkspaceApiKeyConnection!",
    );
    expect(queries.systemApiKeys.type.toString()).toBe(
      "SystemApiKeyConnection!",
    );
    expect(
      (schema.getType("Workspace") as GraphQLObjectType).getFields(),
    ).not.toHaveProperty("apiKeys");
    expect(queries.currentSession?.type.toString()).toBe("Session");
    expect(
      Object.keys(
        (
          schema.getType("UpdateWorkspaceMemberInput") as GraphQLInputObjectType
        ).getFields(),
      ),
    ).toEqual(["name", "email", "status"]);
    expect(mutations.createWorkspaceApiKey?.type.toString()).toBe(
      "CreateWorkspaceApiKeyResult!",
    );
    expect(mutations.updateWorkspaceApiKey?.type.toString()).toBe(
      "WorkspaceApiKey!",
    );
    expect(mutations.deleteWorkspaceApiKey?.type.toString()).toBe(
      "WorkspaceApiKey!",
    );
    expect(
      (schema.getType("AuthSignInResultType") as GraphQLObjectType)
        .getFields()
        .user.type.toString(),
    ).toBe("User!");
    expect(queries.socialProviders).toBeDefined();
    for (const name of [
      "signUp",
      "signIn",
      "signInSocial",
      "signOut",
      "sendVerificationEmail",
      "requestPasswordReset",
      "resetPassword",
      "updateCurrentUser",
      "deleteCurrentUser",
      "changeCurrentUserEmail",
      "changeCurrentUserPassword",
      "setCurrentUserPassword",
      "linkCurrentUserAccount",
      "unlinkCurrentUserAccount",
    ]) {
      expect(mutations[name]).toBeDefined();
    }
    expect(
      mutations.setWorkspaceMemberRoles?.args
        .find(({ name }) => name === "input")
        ?.type.toString(),
    ).toBe("SetWorkspaceMemberRolesInput!");
    for (const name of [
      "revokeCurrentUserSession",
      "revokeCurrentUserOtherSessions",
      "revokeCurrentUserSessions",
      "revokeSession",
      "revokeUserSessions",
    ]) {
      expect(mutations[name].type.toString()).toBe("Boolean!");
    }
    expect(mutations.impersonateUser.type.toString()).toBe("User!");
    for (const operation of [
      "acceptWorkspaceInvitation",
      "rejectWorkspaceInvitation",
      "cancelWorkspaceInvitation",
      "revokeCurrentUserSession",
      "unlinkCurrentUserAccount",
    ]) {
      expect(mutations[operation].args.map(({ name }) => name)).toEqual(["id"]);
      expect(mutations[operation].args[0].type.toString()).toBe("ID!");
    }
    expect(mutations.revokeSession.args.map(({ name }) => name)).toEqual([
      "userId",
      "id",
    ]);
    expect(mutations.revokeUserSessions.args.map(({ name }) => name)).toEqual([
      "userId",
    ]);
    expect(mutations.stopImpersonating.type.toString()).toBe("User");
    expect(mutations.createWorkspace.type.toString()).toBe(
      "CreateWorkspacePayload!",
    );
    expect(mutations.createWorkspaceApiKey.type.toString()).toBe(
      "CreateWorkspaceApiKeyResult!",
    );
    const accepted = schema.getType(
      "AcceptWorkspaceInvitationPayload",
    ) as GraphQLObjectType;
    expect(mutations.acceptWorkspaceInvitation.type.toString()).toBe(
      "AcceptWorkspaceInvitationPayload!",
    );
    expect(Object.keys(accepted.getFields()).sort()).toEqual([
      "id",
      "memberId",
      "workspaceId",
    ]);
    for (const field of Object.values(accepted.getFields())) {
      expect(field.type.toString()).toBe("ID!");
    }
    await moduleRef.close();
  });
});
