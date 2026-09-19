/** Isolated imports must not reset the metadata used by entity contract tests. */
it("should load entities in an isolated module", async () => {
  vi.resetModules();

  expect((await import("./account.entity.js")).Account).toBeDefined();
  expect(
    (await import("./workspace-api-key.entity.js")).WorkspaceApiKey,
  ).toBeDefined();
  expect((await import("./session.entity.js")).Session).toBeDefined();
  expect((await import("./user.entity.js")).User).toBeDefined();
  expect((await import("./verification.entity.js")).Verification).toBeDefined();
  expect((await import("./member.entity.js")).Member).toBeDefined();
  expect((await import("./invitation.entity.js")).Invitation).toBeDefined();
  expect((await import("./workspace.entity.js")).Workspace).toBeDefined();
});
