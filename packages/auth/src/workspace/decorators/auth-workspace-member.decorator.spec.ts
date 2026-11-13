it("resolves WorkspaceMember from the current request", async () => {
  const workspace = { id: "workspace" };
  const user = { id: "user" };
  const expected = { id: "current", status: "ACTIVE", workspace, user };
  const get = vi.fn<(token: symbol | { name?: string }) => unknown>((token) =>
    typeof token === "symbol"
      ? token.description === "SELECTED_WORKSPACE"
        ? workspace
        : null
      : token.name === "WorkspaceMember"
        ? expected
        : token.name === "Workspace"
          ? workspace
          : token.name === "User"
            ? user
            : null,
  );
  vi.resetModules();
  vi.doMock("@nest-boot/request-context", () => ({
    RequestContext: { get, isActive: () => true },
  }));
  vi.doMock("@nestjs/common", async () => ({
    ...(await vi.importActual<typeof import("@nestjs/common")>(
      "@nestjs/common",
    )),
    createParamDecorator: (factory: () => unknown) => factory,
  }));
  try {
    const { AuthWorkspaceMember } =
      await import("./auth-workspace-member.decorator.js");
    expect(AuthWorkspaceMember()).toBe(expected);
    expect(get).toHaveBeenCalled();
    const token = get.mock.calls[0][0];
    expect(typeof token === "symbol" ? token.description : token.name).toBe(
      "WorkspaceMember",
    );
  } finally {
    vi.doUnmock("@nest-boot/request-context");
    vi.doUnmock("@nestjs/common");
  }
});
