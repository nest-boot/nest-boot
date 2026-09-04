import { RequestContext } from "./request-context.js";

describe("RequestContext", () => {
  class Provider {}

  describe("token aliases", () => {
    class BaseProvider {}
    class ApplicationProvider extends BaseProvider {}
    class AlternativeProvider extends BaseProvider {}
    abstract class AbstractProvider {}
    class ConcreteProvider extends AbstractProvider {}

    it("resolves an instance alias to its canonical token", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();

      context.alias(BaseProvider, ApplicationProvider);
      context.set(ApplicationProvider, provider);

      expect(context.get(BaseProvider)).toBe(provider);
      expect(context.get(ApplicationProvider)).toBe(provider);
    });

    it.each([
      ["string", "provider-alias", "provider"],
      ["symbol", Symbol("provider-alias"), Symbol("provider")],
    ])("supports %s token aliases", (_kind, aliasToken, targetToken) => {
      const context = new RequestContext({ type: "test" });
      const provider = {};

      context.alias(aliasToken, targetToken);
      context.set(aliasToken, provider);

      expect(context.get(aliasToken)).toBe(provider);
      expect(context.get(targetToken)).toBe(provider);
    });

    it("supports static alias registration and cancellation", async () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();

      await RequestContext.run(context, () => {
        RequestContext.alias(BaseProvider, ApplicationProvider);
        RequestContext.set(BaseProvider, provider);

        expect(RequestContext.get(BaseProvider)).toBe(provider);
        expect(RequestContext.get(ApplicationProvider)).toBe(provider);

        RequestContext.unalias(BaseProvider);

        expect(RequestContext.get(BaseProvider)).toBeUndefined();
      });
    });

    it("inherits aliases and allows child target overrides", () => {
      const parentProvider = new ApplicationProvider();
      const childProvider = new ApplicationProvider();
      const parent = new RequestContext({ type: "test" });

      parent.alias(BaseProvider, ApplicationProvider);
      parent.set(ApplicationProvider, parentProvider);

      const child = new RequestContext({ parent, type: "test" });

      expect(child.get(BaseProvider)).toBe(parentProvider);

      child.set(BaseProvider, childProvider);

      expect(child.get(BaseProvider)).toBe(childProvider);
      expect(child.get(ApplicationProvider)).toBe(childProvider);
      expect(parent.get(BaseProvider)).toBe(parentProvider);
    });

    it("allows a child to override an inherited alias", () => {
      const applicationProvider = new ApplicationProvider();
      const alternativeProvider = new AlternativeProvider();
      const parent = new RequestContext({ type: "test" });

      parent.alias(BaseProvider, ApplicationProvider);
      parent.set(ApplicationProvider, applicationProvider);

      const child = new RequestContext({ parent, type: "test" });

      child.alias(BaseProvider, AlternativeProvider);
      child.set(AlternativeProvider, alternativeProvider);

      expect(child.get(BaseProvider)).toBe(alternativeProvider);
      expect(parent.get(BaseProvider)).toBe(applicationProvider);
    });

    it("keeps a child alias graph stable when its parent changes later", () => {
      const parent = new RequestContext({ type: "test" });
      const child = new RequestContext({ parent, type: "test" });
      const childProvider = new BaseProvider();
      const parentProvider = new ApplicationProvider();

      child.alias(ApplicationProvider, BaseProvider);
      parent.alias(BaseProvider, ApplicationProvider);

      child.set(ApplicationProvider, childProvider);
      parent.set(BaseProvider, parentProvider);

      expect(child.get(ApplicationProvider)).toBe(childProvider);
      expect(child.get(BaseProvider)).toBe(childProvider);
      expect(parent.get(BaseProvider)).toBe(parentProvider);
      expect(parent.get(ApplicationProvider)).toBe(parentProvider);
    });

    it("keeps inherited aliases after the parent changes later", () => {
      const parent = new RequestContext({ type: "test" });

      parent.alias(BaseProvider, ApplicationProvider);

      const child = new RequestContext({ parent, type: "test" });
      const childProvider = new ApplicationProvider();

      parent.unalias(BaseProvider);
      child.set(BaseProvider, childProvider);

      expect(child.get(BaseProvider)).toBe(childProvider);
      expect(child.get(ApplicationProvider)).toBe(childProvider);
      expect(parent.get(BaseProvider)).toBeUndefined();
    });

    it("resolves alias chains", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new AlternativeProvider();

      context.alias(BaseProvider, ApplicationProvider);
      context.alias(ApplicationProvider, AlternativeProvider);
      context.set(BaseProvider, provider);

      expect(context.get(BaseProvider)).toBe(provider);
      expect(context.get(ApplicationProvider)).toBe(provider);
      expect(context.get(AlternativeProvider)).toBe(provider);
    });

    it("rejects direct and inherited alias cycles", () => {
      const context = new RequestContext({ type: "test" });

      expect(() => {
        context.alias(BaseProvider, BaseProvider);
      }).toThrow(
        "Circular request context alias detected: BaseProvider -> BaseProvider",
      );

      context.alias(BaseProvider, ApplicationProvider);

      expect(() => {
        context.alias(ApplicationProvider, BaseProvider);
      }).toThrow(
        "Circular request context alias detected: ApplicationProvider -> BaseProvider -> ApplicationProvider",
      );

      const provider = new ApplicationProvider();

      context.set(ApplicationProvider, provider);
      expect(context.get(BaseProvider)).toBe(provider);

      const child = new RequestContext({ parent: context, type: "test" });

      expect(() => {
        child.alias(ApplicationProvider, BaseProvider);
      }).toThrow(
        "Circular request context alias detected: ApplicationProvider -> BaseProvider -> ApplicationProvider",
      );
    });

    it("redirects writes through an alias", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();

      context.alias(BaseProvider, ApplicationProvider);
      context.set(BaseProvider, provider);

      expect(context.get(BaseProvider)).toBe(provider);
      expect(context.get(ApplicationProvider)).toBe(provider);
    });

    it("resolves dependencies through the canonical token", () => {
      const provider = new ApplicationProvider();
      const dependencyResolver = vi.fn((token) =>
        token === ApplicationProvider ? provider : undefined,
      );
      const context = new RequestContext({
        dependencyResolver,
        type: "test",
      });

      context.alias(BaseProvider, ApplicationProvider);

      expect(context.get(BaseProvider)).toBe(provider);
      expect(dependencyResolver).toHaveBeenCalledTimes(1);
      expect(dependencyResolver).toHaveBeenCalledWith(ApplicationProvider);
    });

    it("uses an aliased value with getOrSet without overwriting it", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();
      const fallback = new ApplicationProvider();

      context.alias(BaseProvider, ApplicationProvider);
      context.set(ApplicationProvider, provider);

      expect(context.getOrSet(BaseProvider, fallback)).toBe(provider);
      expect(context.get(ApplicationProvider)).toBe(provider);
    });

    it("stores a getOrSet fallback under the canonical token", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();

      context.alias(BaseProvider, ApplicationProvider);

      expect(context.getOrSet(BaseProvider, provider)).toBe(provider);
      expect(context.get(ApplicationProvider)).toBe(provider);
    });

    it("accepts abstract classes and functions in write APIs", async () => {
      const context = new RequestContext({ type: "test" });
      const abstractProvider = new ConcreteProvider();
      const functionProvider = {};
      const functionAliasToken = () => undefined;
      const functionValueToken = () => undefined;

      context.alias(functionAliasToken, AbstractProvider);
      context.set(functionAliasToken, abstractProvider);

      expect(context.get(functionAliasToken)).toBe(abstractProvider);
      expect(context.get(AbstractProvider)).toBe(abstractProvider);

      expect(context.getOrSet(functionValueToken, functionProvider)).toBe(
        functionProvider,
      );

      await RequestContext.run(context, () => {
        RequestContext.set(AbstractProvider, abstractProvider);
        expect(
          RequestContext.getOrSet(functionValueToken, functionProvider),
        ).toBe(functionProvider);
      });
    });

    it("cancels a local alias and allows it to be registered again", () => {
      const context = new RequestContext({ type: "test" });
      const provider = new ApplicationProvider();

      context.alias(BaseProvider, ApplicationProvider);
      context.set(ApplicationProvider, provider);
      context.unalias(BaseProvider);

      expect(context.get(BaseProvider)).toBeUndefined();

      const directProvider = new BaseProvider();

      context.set(BaseProvider, directProvider);

      expect(context.get(BaseProvider)).toBe(directProvider);
      expect(context.get(ApplicationProvider)).toBe(provider);

      context.alias(BaseProvider, ApplicationProvider);

      expect(context.get(BaseProvider)).toBe(provider);
    });

    it("cancels an inherited alias without modifying the parent", () => {
      const provider = new ApplicationProvider();
      const parent = new RequestContext({ type: "test" });

      parent.alias(BaseProvider, ApplicationProvider);
      parent.set(ApplicationProvider, provider);

      const child = new RequestContext({ parent, type: "test" });

      child.unalias(BaseProvider);

      expect(child.get(BaseProvider)).toBeUndefined();

      const childProvider = new BaseProvider();

      child.set(BaseProvider, childProvider);

      expect(child.get(BaseProvider)).toBe(childProvider);
      expect(parent.get(BaseProvider)).toBe(provider);
    });
  });

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

  it("uses its own dependency resolver after an empty parent context", () => {
    const provider = new Provider();
    const dependencyResolver = vi.fn(() => provider);
    const parent = new RequestContext({ type: "test" });
    const child = new RequestContext({
      dependencyResolver,
      parent,
      type: "test",
    });

    expect(child.get(Provider)).toBe(provider);
    expect(dependencyResolver).toHaveBeenCalledWith(Provider);
  });
});
