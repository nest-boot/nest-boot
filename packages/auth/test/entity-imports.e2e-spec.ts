/** Isolated imports must not reset the metadata used by entity contract tests. */
it("should load entities in an isolated module", async () => {
  vi.resetModules();

  expect(
    (await import("../dist/entities/account.entity.js")).Account,
  ).toBeDefined();
  expect(
    (await import("../dist/entities/member-api-key.entity.js")).MemberApiKey,
  ).toBeDefined();
  expect(
    (await import("../dist/entities/session.entity.js")).Session,
  ).toBeDefined();
  expect((await import("../dist/entities/user.entity.js")).User).toBeDefined();
  expect(
    (await import("../dist/entities/verification.entity.js")).Verification,
  ).toBeDefined();
  expect(
    (await import("../dist/entities/member.entity.js")).Member,
  ).toBeDefined();
  expect(
    (await import("../dist/entities/invitation.entity.js")).Invitation,
  ).toBeDefined();
  expect(
    (await import("../dist/entities/workspace.entity.js")).Workspace,
  ).toBeDefined();
});
