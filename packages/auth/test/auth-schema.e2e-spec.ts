import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLInputObjectType, GraphQLObjectType } from "graphql";

import { InvitationResolver } from "../src/features/invitations/invitation.resolver.js";
import { AuthResolver } from "../src/resolvers/auth.resolver.js";
import { MemberResolver } from "../src/resolvers/member.resolver.js";
import { MemberApiKeyResolver } from "../src/resolvers/member-api-key.resolver.js";
import { SessionResolver } from "../src/resolvers/session.resolver.js";
import { UserResolver } from "../src/resolvers/user.resolver.js";
import { UserApiKeyResolver } from "../src/resolvers/user-api-key.resolver.js";
import { WorkspaceResolver } from "../src/resolvers/workspace.resolver.js";

// Filter-scalar execution is covered by the example's real-server e2e tests.
describe("auth GraphQL schema", () => {
  it("builds the built-in schema without application type registration", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([
      AuthResolver,
      UserResolver,
      SessionResolver,
      WorkspaceResolver,
      MemberResolver,
      UserApiKeyResolver,
      MemberApiKeyResolver,
      InvitationResolver,
    ]);
    expect(schema.getQueryType()?.getFields().currentUser.type.toString()).toBe(
      "User!",
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
      ["addMember", "AddMemberPayload", "id"],
      ["setMemberRoles", "SetMemberRolesPayload", "id"],
      ["setMemberPermissions", "SetMemberPermissionsPayload", "id"],
      ["createInvitation", "CreateInvitationPayload", "id"],
      ["rejectInvitation", "RejectInvitationPayload", "id"],
      ["cancelInvitation", "CancelInvitationPayload", "id"],
      ["deleteWorkspace", "DeleteWorkspacePayload", "id"],
      ["deleteUser", "DeleteUserPayload", "id"],
      ["removeMember", "RemoveMemberPayload", "id"],
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
      schema.getMutationType()?.getFields().updateMember.type.toString(),
    ).toBe("UpdateMemberPayload");
    expect(
      Object.keys(
        (
          schema.getType("UpdateMemberPayload") as GraphQLObjectType
        ).getFields(),
      ),
    ).toEqual(["id"]);
    expect(
      (schema.getType("Member") as GraphQLObjectType)
        .getFields()
        .user.type.toString(),
    ).toBe("User");
    const invitationFields = (
      schema.getType("Invitation") as GraphQLObjectType
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
    expect(queries.member?.type.toString()).toBe("Member");
    expect(queries.invitation?.type.toString()).toBe("Invitation");
    expect(queries.currentMember?.type.toString()).toBe("Member");
    for (const [type, field] of [
      ["Workspace", "invitations"],
      ["User", "invitations"],
    ]) {
      const fields = (schema.getType(type) as GraphQLObjectType).getFields();
      expect(fields[field]?.type.toString()).toBe("InvitationConnection!");
      expect(fields[field]?.args.map(({ name }) => name)).toContain("first");
    }
    for (const type of [
      "UserApiKeyPermissionOption",
      "MemberApiKeyPermissionOption",
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
      ["Member", "roles", "WorkspaceRole"],
      ["Member", "permissions", "WorkspacePermission"],
      ["Invitation", "roles", "WorkspaceRole"],
      ["UserApiKey", "permissions", "UserApiKeyPermission"],
      ["MemberApiKey", "permissions", "MemberApiKeyPermission"],
      ["CreateMemberApiKeyInput", "permissions", "MemberApiKeyPermission"],
      ["UpdateMemberApiKeyInput", "permissions", "MemberApiKeyPermission"],
      ["CreateUserInput", "roles", "UserRole"],
      ["CreateUserInput", "permissions", "UserPermission"],
      ["CreateInvitationInput", "roles", "WorkspaceRole"],
      ["SetUserRolesInput", "roles", "UserRole"],
      ["SetMemberRolesInput", "roles", "WorkspaceRole"],
      ["SetUserPermissionsInput", "permissions", "UserPermission"],
      ["SetMemberPermissionsInput", "permissions", "WorkspacePermission"],
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
      ["Workspace", "members", "MemberConnection"],
      ["Workspace", "apiKeys", "MemberApiKeyConnection"],
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
      ["Workspace", "MemberApiKey"],
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
    expect(queries.currentSession?.type.toString()).toBe("Session");
    expect(
      Object.keys(
        (
          schema.getType("UpdateMemberInput") as GraphQLInputObjectType
        ).getFields(),
      ),
    ).toEqual(["name", "email", "status"]);
    expect(mutations.createMemberApiKey?.type.toString()).toBe(
      "CreateMemberApiKeyResult!",
    );
    expect(mutations.updateMemberApiKey?.type.toString()).toBe("MemberApiKey!");
    expect(mutations.deleteMemberApiKey?.type.toString()).toBe("MemberApiKey!");
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
      mutations.setMemberRoles?.args
        .find(({ name }) => name === "input")
        ?.type.toString(),
    ).toBe("SetMemberRolesInput!");
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
      "acceptInvitation",
      "rejectInvitation",
      "cancelInvitation",
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
    expect(mutations.createMemberApiKey.type.toString()).toBe(
      "CreateMemberApiKeyResult!",
    );
    const accepted = schema.getType(
      "AcceptInvitationPayload",
    ) as GraphQLObjectType;
    expect(mutations.acceptInvitation.type.toString()).toBe(
      "AcceptInvitationPayload!",
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
