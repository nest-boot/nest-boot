/** Isolated imports must not reset the metadata used by entity contract tests. */
it("should load entities in an isolated module", async () => {
  vi.resetModules();

  expect(
    (await import("../src/core/entities/account.entity.js")).Account,
  ).toBeDefined();
  expect(
    (await import("../src/api-key/entities/workspace-api-key.entity.js"))
      .WorkspaceApiKey,
  ).toBeDefined();
  expect(
    (await import("../src/core/entities/session.entity.js")).Session,
  ).toBeDefined();
  expect(
    (await import("../src/core/entities/user.entity.js")).User,
  ).toBeDefined();
  expect(
    (await import("../src/core/entities/verification.entity.js")).Verification,
  ).toBeDefined();
  expect(
    (await import("../src/workspace/entities/member.entity.js")).Member,
  ).toBeDefined();
  expect(
    (await import("../src/workspace/entities/invitation.entity.js")).Invitation,
  ).toBeDefined();
  expect(
    (await import("../src/workspace/entities/workspace.entity.js")).Workspace,
  ).toBeDefined();
});
