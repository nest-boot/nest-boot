import {
  Args,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Resolver,
} from "@nest-boot/graphql";
// eslint-disable-next-line @nest-boot/import-graphql -- Verify that the public exports are the native decorators.
import { Args as NestArgs, Resolver as NestResolver } from "@nestjs/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLInputObjectType, GraphQLObjectType } from "graphql";

import { AuthModule } from "./auth.module.js";
import { InvitationResolver } from "./features/invitations/invitation.resolver.js";
import { CAN_METADATA } from "./permission.constants.js";
import { AuthResolver } from "./resolvers/auth.resolver.js";
import { MemberResolver } from "./resolvers/member.resolver.js";
import { SessionResolver } from "./resolvers/session.resolver.js";
import { UserResolver } from "./resolvers/user.resolver.js";
import { UserApiKeyResolver } from "./resolvers/user-api-key.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";
import { WorkspaceApiKeyResolver } from "./resolvers/workspace-api-key.resolver.js";

// Filter-scalar execution is covered by the example's real-server e2e tests.
describe("auth GraphQL schema", () => {
  it("uses native Nest Resolver and Args decorators", () => {
    expect(Resolver).toBe(NestResolver);
    expect(Args).toBe(NestArgs);
  });
  it("binds every resolver to its GraphQL object name", () => {
    for (const [resolver, name] of [
      [AuthResolver, "User"],
      [UserResolver, "User"],
      [SessionResolver, "Session"],
      [UserApiKeyResolver, "UserApiKey"],
      [WorkspaceApiKeyResolver, "WorkspaceApiKey"],
      [WorkspaceResolver, "Workspace"],
      [MemberResolver, "Member"],
      [InvitationResolver, "Invitation"],
    ] as const) {
      expect(Reflect.getMetadata("graphql:resolver_type", resolver)).toBe(name);
      const dependencies = Reflect.getMetadata(
        "design:paramtypes",
        resolver,
      ) as { name: string }[] | undefined;
      expect(dependencies?.map(({ name }) => name) ?? []).not.toContain(
        "ConnectionManager",
      );
    }
  });

  it("registers all root APIs in AuthModule", () => {
    expect(AuthModule).toHaveProperty("forRoot");
    expect(Reflect.getMetadata("providers", AuthModule)).toEqual(
      expect.arrayContaining([
        AuthResolver,
        UserResolver,
        SessionResolver,
        UserApiKeyResolver,
        WorkspaceApiKeyResolver,
        WorkspaceResolver,
        MemberResolver,
        InvitationResolver,
      ]),
    );
  });

  it("leaves authorization to services without resolver permission metadata", () => {
    for (const resolver of [
      AuthResolver,
      UserResolver,
      SessionResolver,
      UserApiKeyResolver,
      WorkspaceApiKeyResolver,
      WorkspaceResolver,
      MemberResolver,
      InvitationResolver,
    ]) {
      for (const name of Object.getOwnPropertyNames(resolver.prototype)) {
        const method = Object.getOwnPropertyDescriptor(
          resolver.prototype,
          name,
        )?.value;
        if (typeof method !== "function") continue;
        expect(Reflect.getMetadata(CAN_METADATA, method)).toBeUndefined();
      }
    }
  });

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
      WorkspaceApiKeyResolver,
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
    expect(schema.getType("AuthSignUpResultType")).toBeUndefined();

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
    expect(schema.getType("UserListType")).toBeUndefined();
    expect(schema.getType("AuthUserType")).toBeUndefined();
    expect(schema.getQueryType()?.getFields().users.type.toString()).toBe(
      "UserConnection!",
    );

    for (const oldType of [
      "WorkspaceMember",
      "WorkspaceInvitation",
      "WorkspaceMemberConnection",
      "WorkspaceInvitationConnection",
      "WorkspaceMemberStatus",
      "UpdateWorkspaceMemberInput",
      "CreateWorkspaceInvitationInput",
    ])
      expect(schema.getType(oldType)).toBeUndefined();
    const queries = schema.getQueryType()?.getFields();
    if (!queries) throw new Error("Query type is missing");
    expect(queries.member?.type.toString()).toBe("Member");
    expect(queries.invitation?.type.toString()).toBe("Invitation");
    expect(queries.currentMember?.type.toString()).toBe("Member");
    for (const oldQuery of [
      "workspaceMember",
      "workspaceInvitation",
      "currentWorkspaceMember",
    ])
      expect(queries[oldQuery]).toBeUndefined();
    expect(
      (schema.getType("User") as GraphQLObjectType).getFields()
        .workspaceInvitations,
    ).toBeUndefined();
    expect(queries.invitations).toBeUndefined();
    expect(queries.currentUserInvitations).toBeUndefined();
    for (const [type, field] of [
      ["Workspace", "invitations"],
      ["User", "invitations"],
    ]) {
      const fields = (schema.getType(type) as GraphQLObjectType).getFields();
      expect(fields[field]?.type.toString()).toBe("InvitationConnection!");
      expect(fields[field]?.args.map(({ name }) => name)).toContain("first");
    }
    expect(queries.workspaceAssignableRoles).toBeUndefined();
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
      ["Member", "roles", "WorkspaceRole"],
      ["Member", "permissions", "WorkspacePermission"],
      ["Invitation", "roles", "WorkspaceRole"],
      ["UserApiKey", "permissions", "UserApiKeyPermission"],
      ["WorkspaceApiKey", "permissions", "WorkspaceApiKeyPermission"],
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
    expect(schema.getType("AuthRoleType")).toBeUndefined();
    expect(queries.currentSession.type.toString()).toBe("Session");
    expect(queries.authSessions).toBeUndefined();
    expect(queries.authAccounts).toBeUndefined();
    expect(queries.authFetchAccessToken).toBeUndefined();
    expect(queries.authFetchAccountInfo).toBeUndefined();
    expect(queries.userSessions).toBeUndefined();
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
    expect(schema.getType("AuthSessionType")).toBeUndefined();
    expect(
      (schema.getType("Session") as GraphQLObjectType).getFields(),
    ).not.toHaveProperty("token");
    for (const name of [
      "workspaces",
      "members",
      "apiKeys",
      "userApiKeys",
      "apiKey",
      "userApiKey",
      "workspaceApiKey",
    ]) {
      expect(queries[name]).toBeUndefined();
    }
    for (const [type, field, connection] of [
      ["User", "workspaces", "WorkspaceConnection"],
      ["User", "apiKeys", "UserApiKeyConnection"],
      ["Workspace", "members", "MemberConnection"],
      ["Workspace", "apiKeys", "WorkspaceApiKeyConnection"],
    ]) {
      const resolved = (schema.getType(type) as GraphQLObjectType).getFields()[
        field
      ];
      expect(resolved?.type.toString()).toBe(`${connection}!`);
      expect(resolved?.args.map(({ name }) => name)).toContain("first");
      if (field === "apiKeys")
        expect(resolved.args.map(({ name }) => name)).toContain("filter");
    }
    for (const type of ["User", "Workspace"]) {
      const field = (schema.getType(type) as GraphQLObjectType).getFields()
        .apiKey;
      expect(field?.type.toString()).toBe(`${type}ApiKey`);
      expect(
        field?.args.map(({ name, type }) => [name, type.toString()]),
      ).toEqual([["id", "ID!"]]);
    }
    const mutations = schema.getMutationType()?.getFields();
    if (!mutations) throw new Error("Mutation type is missing");
    for (const oldMutation of [
      "addWorkspaceMember",
      "updateWorkspaceMember",
      "setWorkspaceMemberRoles",
      "setWorkspaceMemberPermissions",
      "removeWorkspaceMember",
      "createWorkspaceInvitation",
      "acceptWorkspaceInvitation",
      "rejectWorkspaceInvitation",
      "cancelWorkspaceInvitation",
    ])
      expect(mutations[oldMutation]).toBeUndefined();
    expect(queries.currentSession?.type.toString()).toBe("Session");
    expect(queries.currentAuthSession).toBeUndefined();
    expect(mutations.removeWorkspace).toBeUndefined();
    for (const oldName of [
      "createApiKey",
      "updateApiKey",
      "deleteApiKey",
      "authAccessToken",
      "authAccountInfo",
      "createServiceAccountMember",
      "createWorkspaceServiceAccount",
    ]) {
      expect(mutations[oldName]).toBeUndefined();
    }
    expect(schema.getType("CreateServiceAccountMemberInput")).toBeUndefined();
    expect(
      schema.getType("CreateWorkspaceServiceAccountInput"),
    ).toBeUndefined();
    expect(
      Object.keys(
        (
          schema.getType("UpdateMemberInput") as GraphQLInputObjectType
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
    for (const name of [
      "authFetchAccessToken",
      "authFetchAccountInfo",
      "authRefreshToken",
      "authAccessToken",
      "authAccountInfo",
    ]) {
      expect(queries[name]).toBeUndefined();
      expect(mutations[name]).toBeUndefined();
    }
    for (const name of [
      "AuthAccountSelectorInput",
      "AuthAccountIdentityType",
      "AuthAccessTokenType",
      "AuthRefreshedTokenType",
      "AuthAccountInfoType",
    ]) {
      expect(schema.getType(name)).toBeUndefined();
    }
    expect(
      (schema.getType("AuthSignInResultType") as GraphQLObjectType)
        .getFields()
        .user.type.toString(),
    ).toBe("User!");
    expect(
      Object.keys(queries).filter((name) => name.startsWith("auth")),
    ).toEqual([]);
    expect(
      Object.keys(mutations).filter((name) => name.startsWith("auth")),
    ).toEqual([]);
    expect(mutations.revokeUserSession).toBeUndefined();
    expect(mutations.linkCurrentUserSocialAccount).toBeUndefined();
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
    expect(mutations.updateMemberRoles).toBeUndefined();
    expect(
      mutations.setMemberRoles?.args
        .find(({ name }) => name === "input")
        ?.type.toString(),
    ).toBe("SetMemberRolesInput!");
    expect(schema.getType("UpdateMemberRolesInput")).toBeUndefined();
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
    expect(mutations.transferWorkspaceOwnership).toBeUndefined();
    expect(mutations.stopImpersonating.type.toString()).toBe("User");
    expect(mutations.createWorkspace.type.toString()).toBe(
      "CreateWorkspacePayload!",
    );
    expect(mutations.createWorkspaceApiKey.type.toString()).toBe(
      "CreateWorkspaceApiKeyResult!",
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
    expect(schema.getType("AcceptInvitationResult")).toBeUndefined();

    await moduleRef.close();
  });
});
