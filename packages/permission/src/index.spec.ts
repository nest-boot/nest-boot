describe("public API", () => {
  it("should export permission package APIs", async () => {
    const api = await import(".");

    expect(api.Can).toBeDefined();
    expect(api.PermissionAction).toBeDefined();
    expect(api.PermissionAbilityBuilder).toBeDefined();
    expect(api.PermissionGuard).toBeDefined();
    expect(api.PermissionModule).toBeDefined();
    expect(api.can).toBeDefined();
    expect(api.getPermissionAbility).toBeDefined();
  });
});
