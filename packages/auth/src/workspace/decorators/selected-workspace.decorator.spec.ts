it("resolves Workspace from the current request", async () => {
  const expected = { id: "current" };
  const get = vi.fn<(token: symbol | { name?: string }) => unknown>(
    () => expected,
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
    const { SelectedWorkspace } =
      await import("./selected-workspace.decorator.js");
    expect(SelectedWorkspace()).toBe(expected);
    expect(get).toHaveBeenCalledTimes(1);
    const token = get.mock.calls[0][0];
    expect(typeof token === "symbol" ? token.description : token.name).toBe(
      "Workspace",
    );
  } finally {
    vi.doUnmock("@nest-boot/request-context");
    vi.doUnmock("@nestjs/common");
  }
});
