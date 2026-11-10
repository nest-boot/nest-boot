/** Isolated imports must not reset the metadata used by entity contract tests. */
it("should load entities in an isolated module", async () => {
  vi.resetModules();

  expect(
    (await import("../src/entities/account.entity.js")).Account,
  ).toBeDefined();
  expect(
    (await import("../src/entities/member-api-key.entity.js")).MemberApiKey,
  ).toBeDefined();
  expect(
    (await import("../src/entities/session.entity.js")).Session,
  ).toBeDefined();
  expect((await import("../src/entities/user.entity.js")).User).toBeDefined();
  expect(
    (await import("../src/entities/verification.entity.js")).Verification,
  ).toBeDefined();
  expect(
    (await import("../src/entities/member.entity.js")).Member,
  ).toBeDefined();
  expect(
    (await import("../src/entities/invitation.entity.js")).Invitation,
  ).toBeDefined();
  expect(
    (await import("../src/entities/workspace.entity.js")).Workspace,
  ).toBeDefined();
});
