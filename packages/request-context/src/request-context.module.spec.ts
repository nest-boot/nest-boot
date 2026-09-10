import type { DynamicModule, ValueProvider } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { RequestContext, type RequestContextToken } from "./request-context.js";
import { RequestContextModule } from "./request-context.module.js";

describe("RequestContextModule", () => {
  class ContextValue {
    #value: string;

    constructor(value: string) {
      this.#value = value;
    }

    get value(): string {
      return this.#value;
    }

    set value(value: string) {
      this.#value = value;
    }

    describe(suffix: string): string {
      return `${this.#value}${suffix}`;
    }
  }

  it("registers and exports a proxy under the feature token", () => {
    const dynamicModule = RequestContextModule.forFeature(ContextValue);
    const provider = getFeatureProvider(dynamicModule, ContextValue);

    expect(provider.provide).toBe(ContextValue);
    expect(dynamicModule.exports).toContain(ContextValue);
  });

  it("makes the context proxy injectable from the importing module", async () => {
    const testingModule = await Test.createTestingModule({
      imports: [RequestContextModule.forFeature(ContextValue)],
      providers: [
        {
          provide: "CONSUMER",
          inject: [ContextValue],
          useFactory: (contextValue: ContextValue) => ({ contextValue }),
        },
      ],
    }).compile();
    const consumer = testingModule.get<{ contextValue: ContextValue }>(
      "CONSUMER",
    );

    try {
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        (context) => {
          context.set(ContextValue, new ContextValue("injected"));

          expect(consumer.contextValue.describe("!")).toBe("injected!");
        },
      );
    } finally {
      await testingModule.close();
    }
  });

  it("delegates property access and method calls to the active context value", async () => {
    const dynamicModule = RequestContextModule.forFeature(ContextValue);
    const proxy = getFeatureProvider(dynamicModule, ContextValue).useValue;

    expect(proxy.value).toBeUndefined();

    await RequestContext.run(
      new RequestContext({ id: "first", type: "test" }),
      (context) => {
        context.set(ContextValue, new ContextValue("first"));

        expect(proxy.value).toBe("first");
        expect(proxy.describe("!")).toBe("first!");

        proxy.value = "updated";
        expect(context.get(ContextValue)?.value).toBe("updated");
      },
    );

    await RequestContext.run(
      new RequestContext({ id: "second", type: "test" }),
      (context) => {
        context.set(ContextValue, new ContextValue("second"));

        expect(proxy.value).toBe("second");
        expect(proxy.describe("!")).toBe("second!");
      },
    );
  });

  it("resolves detached methods against the context active at invocation", async () => {
    const dynamicModule = RequestContextModule.forFeature(ContextValue);
    const proxy = getFeatureProvider(dynamicModule, ContextValue).useValue;
    const getDescribe = (): ContextValue["describe"] =>
      Reflect.get(proxy, "describe");
    let describe!: ContextValue["describe"];

    await RequestContext.run(
      new RequestContext({ type: "test" }),
      (context) => {
        context.set(ContextValue, new ContextValue("first"));
        describe = getDescribe();

        expect(getDescribe()).toBe(getDescribe());
      },
    );

    await RequestContext.run(
      new RequestContext({ type: "test" }),
      (context) => {
        context.set(ContextValue, new ContextValue("second"));

        expect(describe("!")).toBe("second!");
      },
    );
  });

  it("supports symbol tokens with an explicit value type", async () => {
    const token = Symbol("CONTEXT_VALUE");
    const dynamicModule = RequestContextModule.forFeature<ContextValue>(token);
    const proxy = getFeatureProvider(dynamicModule, token).useValue;

    await RequestContext.run(
      new RequestContext({ type: "test" }),
      (context) => {
        context.set(token, new ContextValue("symbol"));

        expect(proxy.describe("!")).toBe("symbol!");
      },
    );
  });

  it("does not resolve a registered proxy as its own context value", async () => {
    const dynamicModule = RequestContextModule.forFeature(ContextValue);
    const proxy = getFeatureProvider(dynamicModule, ContextValue).useValue;

    await RequestContext.run(
      new RequestContext({
        dependencyResolver: () => proxy,
        type: "test",
      }),
      () => {
        expect(proxy.value).toBeUndefined();
      },
    );
  });
});

function getFeatureProvider<T extends object>(
  dynamicModule: DynamicModule,
  token: RequestContextToken<T>,
): ValueProvider<T> {
  const provider = dynamicModule.providers?.find(
    (candidate): candidate is ValueProvider<T> =>
      typeof candidate === "object" &&
      candidate !== null &&
      "provide" in candidate &&
      candidate.provide === token &&
      "useValue" in candidate,
  );

  if (!provider) {
    throw new Error("Expected the request context feature provider");
  }

  return provider;
}
