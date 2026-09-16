import * as publicApi from "./index.js";
describe("public API", () => {
  it("owns all concrete auth entities and connection types", () => {
    const names = [
      "User",
      "Account",
      "Session",
      "Verification",
      "Workspace",
      "Member",
      "Invitation",
      "ApiKey",
    ] as const;
    expect(publicApi.entities).toHaveLength(names.length);
    for (const name of names) {
      expect(publicApi.entities).toContain(publicApi[name]);
      expect(publicApi).not.toHaveProperty(`Base${name}`);
      if (name !== "Verification")
        expect(publicApi).toHaveProperty(`${name}Connection`);
    }
    expect(publicApi).not.toHaveProperty("AuthGraphQLModule");
  });
  it("does not export provider credential transport types", () => {
    for (const name of [
      "AuthAccountSelectorInput",
      "AuthAccountIdentityType",
      "AuthAccessTokenType",
      "AuthRefreshedTokenType",
      "AuthAccountInfoType",
    ])
      expect(publicApi).not.toHaveProperty(name);
  });
  it("exports the GraphQL module and resolvers", () => {
    expect(publicApi.AuthModule).toBeDefined();
    expect(publicApi.AuthResolver).toBeDefined();
    expect(publicApi.UserResolver).toBeDefined();
    expect(publicApi.SessionResolver).toBeDefined();
    for (const name of [
      "ApiKeyResolver",
      "WorkspaceResolver",
      "MemberResolver",
      "InvitationResolver",
    ]) {
      expect(publicApi).toHaveProperty(name);
      expect(publicApi).not.toHaveProperty(`create${name}`);
    }
    expect(publicApi).not.toHaveProperty("AuthRoleType");
    for (const token of [
      "API_KEY_RESOLVER_OPTIONS",
      "WORKSPACE_RESOLVER_OPTIONS",
      "WORKSPACE_MEMBER_RESOLVER_OPTIONS",
      "WORKSPACE_INVITATION_RESOLVER_OPTIONS",
    ])
      expect(publicApi).not.toHaveProperty(token);
    expect(publicApi).toHaveProperty("SetMemberRolesInput");
    expect(publicApi).not.toHaveProperty("UpdateMemberRolesInput");
  });

  it("exports input and result types", () => {
    expect(publicApi.AuthSignInInput).toBeDefined();
    expect(publicApi.AuthSignInResultType).toBeDefined();
    expect(publicApi.CreateUserInput).toBeDefined();
    expect(publicApi.CreateWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteUserPayload).toBeDefined();
    expect(publicApi.RemoveMemberPayload).toBeDefined();
    expect(publicApi.LeaveWorkspacePayload).toBeDefined();
    expect(publicApi).not.toHaveProperty("CreateWorkspaceServiceAccountInput");
    expect(publicApi).not.toHaveProperty("CreateServiceAccountMemberInput");
    expect(publicApi).not.toHaveProperty("UserListType");
    expect(publicApi).not.toHaveProperty("ListUsersInput");
    expect(publicApi).not.toHaveProperty("AuthUserType");
    expect(publicApi).not.toHaveProperty("AuthAccountType");
  });
});
