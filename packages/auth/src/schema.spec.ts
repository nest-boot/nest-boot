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
import {
  USER_CAN_METADATA,
  WORKSPACE_CAN_METADATA,
} from "./permission.constants.js";
import { ApiKeyResolver } from "./resolvers/api-key.resolver.js";
import { AuthResolver } from "./resolvers/auth.resolver.js";
import { InvitationResolver } from "./resolvers/invitation.resolver.js";
import { MemberResolver } from "./resolvers/member.resolver.js";
import { SessionResolver } from "./resolvers/session.resolver.js";
import { UserResolver } from "./resolvers/user.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";

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
      [ApiKeyResolver, "ApiKey"],
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
        ApiKeyResolver,
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
      ApiKeyResolver,
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
        expect(Reflect.getMetadata(USER_CAN_METADATA, method)).toBeUndefined();
        expect(
          Reflect.getMetadata(WORKSPACE_CAN_METADATA, method),
        ).toBeUndefined();
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
      ApiKeyResolver,
      InvitationResolver,
    ]);

    expect(schema.getQueryType()?.getFields().currentUser.type.toString()).toBe(
      "User!",
    );
    expect(schema.getQueryType()?.getFields().user.type.toString()).toBe(
      "User",
    );
    expect(
      schema.getMutationType()?.getFields().createUser.type.toString(),
    ).toBe("User!");

    for (const [operation, payload, field] of [
      ["createWorkspace", "CreateWorkspacePayload", "id"],
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
      schema.getMutationType()?.getFields().updateWorkspace.type.toString(),
    ).toBe("Workspace!");

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
    expect(queries.userRoles.type.toString()).toBe("[String!]!");
    expect(queries.workspaceRoles.type.toString()).toBe("[String!]!");
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
      ["User", "apiKeys", "ApiKeyConnection"],
      ["Workspace", "members", "MemberConnection"],
      ["Workspace", "apiKeys", "ApiKeyConnection"],
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
      expect(field?.type.toString()).toBe("ApiKey");
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
      "CreateApiKeyResult!",
    );
    expect(mutations.updateWorkspaceApiKey?.type.toString()).toBe("ApiKey!");
    expect(mutations.deleteWorkspaceApiKey?.type.toString()).toBe("ApiKey!");
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
    expect(mutations.setMemberRoles?.type.toString()).toBe("Member!");
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
      "CreateApiKeyResult!",
    );
    const accepted = schema.getType(
      "AcceptInvitationResult",
    ) as GraphQLObjectType;
    expect(accepted.getFields().invitation.type.toString()).toBe("Invitation!");
    expect(accepted.getFields().member.type.toString()).toBe("Member!");

    await moduleRef.close();
  });
});
