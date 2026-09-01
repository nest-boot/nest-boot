import { RequestContext } from "./request-context.js";

describe("RequestContext", () => {
  class Provider {}

  it.each([null, undefined])(
    "preserves a local explicit %s value before dependency resolution",
    (value) => {
      const dependencyResolver = vi.fn(() => new Provider());
      const context = new RequestContext({
        dependencyResolver,
        type: "test",
      });

      context.set<Provider | null | undefined>(Provider, value);

      expect(context.get<Provider | null>(Provider)).toBe(value);
      expect(dependencyResolver).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined])(
    "preserves a parent explicit %s value before dependency resolution",
    (value) => {
      const dependencyResolver = vi.fn(() => new Provider());
      const parent = new RequestContext({ type: "test" });
      const child = new RequestContext({
        dependencyResolver,
        parent,
        type: "test",
      });

      parent.set<Provider | null | undefined>(Provider, value);

      expect(child.get<Provider | null>(Provider)).toBe(value);
      expect(dependencyResolver).not.toHaveBeenCalled();
    },
  );

  it("inherits dependency resolution through a parent context", () => {
    const provider = new Provider();
    const dependencyResolver = vi.fn(() => provider);
    const parent = new RequestContext({
      dependencyResolver,
      type: "test",
    });
    const child = new RequestContext({ parent, type: "test" });

    expect(child.get(Provider)).toBe(provider);
    expect(dependencyResolver).toHaveBeenCalledWith(Provider);
  });
});
