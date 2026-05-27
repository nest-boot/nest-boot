import { NestMiddleware } from "@nestjs/common";
import { MiddlewareConsumer } from "@nestjs/common/interfaces";

import * as MiddlewareExports from ".";
import { MiddlewareManager } from "./middleware.manager";
import { MiddlewareModule } from "./middleware.module";
import { MiddlewareFunction } from "./types";

abstract class RecordingMiddleware implements NestMiddleware {
  constructor(
    private readonly name: string,
    private readonly calls: string[],
  ) {}

  use(_req: unknown, _res: unknown, next: () => void) {
    this.calls.push(this.name);
    next();
  }
}

class FirstMiddleware extends RecordingMiddleware {}
class SecondMiddleware extends RecordingMiddleware {}
class MissingMiddleware extends RecordingMiddleware {}

const createMiddlewareConsumer = () => {
  const middlewares: MiddlewareFunction[] = [];
  const proxy = {
    exclude: jest.fn().mockReturnThis(),
    forRoutes: jest.fn().mockReturnThis(),
  };
  const consumer = {
    apply: jest.fn((middleware: MiddlewareFunction) => {
      middlewares.push(middleware);
      return proxy;
    }),
  } as unknown as MiddlewareConsumer;

  return { consumer, middlewares, proxy };
};

const collectMiddlewares = (manager: MiddlewareManager) => {
  const { consumer, middlewares } = createMiddlewareConsumer();

  manager.configure(consumer);

  return middlewares;
};

const runMiddlewares = (middlewares: MiddlewareFunction[]) => {
  for (const middleware of middlewares) {
    middleware({}, {}, jest.fn());
  }
};

describe("MiddlewareManager", () => {
  it("exports middleware APIs from the package entrypoint", () => {
    expect(MiddlewareExports.MiddlewareManager).toBe(MiddlewareManager);
    expect(MiddlewareExports.MiddlewareModule).toBe(MiddlewareModule);
  });

  it("applies middleware after target middleware", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const second = new SecondMiddleware("second", calls);
    const manager = new MiddlewareManager();

    manager.apply(second).after(FirstMiddleware).forRoutes("*");
    manager.apply(first).forRoutes("*");

    runMiddlewares(collectMiddlewares(manager));

    expect(calls).toEqual(["first", "second"]);
  });

  it("applies hard dependency middleware before current middleware", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const second = new SecondMiddleware("second", calls);
    const manager = new MiddlewareManager();

    manager.apply(second).dependencies(FirstMiddleware).forRoutes("*");
    manager.apply(first).forRoutes("*");

    runMiddlewares(collectMiddlewares(manager));

    expect(calls).toEqual(["first", "second"]);
  });

  it("applies middleware before target middleware", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const second = new SecondMiddleware("second", calls);
    const manager = new MiddlewareManager();

    manager.apply(second).forRoutes("*");
    manager.apply(first).before(SecondMiddleware).forRoutes("*");

    runMiddlewares(collectMiddlewares(manager));

    expect(calls).toEqual(["first", "second"]);
  });

  it("ignores after target middleware when it is not registered", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const manager = new MiddlewareManager();

    manager.apply(first).after(MissingMiddleware).forRoutes("*");

    runMiddlewares(collectMiddlewares(manager));

    expect(calls).toEqual(["first"]);
  });

  it("ignores before target middleware when it is not registered", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const manager = new MiddlewareManager();

    manager.apply(first).before(MissingMiddleware).forRoutes("*");

    runMiddlewares(collectMiddlewares(manager));

    expect(calls).toEqual(["first"]);
  });

  it("throws when dependencies reference an unregistered middleware", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const manager = new MiddlewareManager();

    manager.apply(first).dependencies(MissingMiddleware).forRoutes("*");

    expect(() => collectMiddlewares(manager)).toThrow(
      "Dependency middleware MissingMiddleware is not registered",
    );
  });

  it("throws when middleware ordering is circular", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const second = new SecondMiddleware("second", calls);
    const manager = new MiddlewareManager();

    manager.apply(first).before(SecondMiddleware).forRoutes("*");
    manager.apply(second).before(FirstMiddleware).forRoutes("*");

    expect(() => collectMiddlewares(manager)).toThrow(
      "Circular dependency detected in middleware",
    );
  });

  it("applies function middleware with route exclusions", () => {
    const calls: string[] = [];
    const manager = new MiddlewareManager();
    const { consumer, middlewares, proxy } = createMiddlewareConsumer();

    manager
      .globalExclude("/global")
      .apply((_req, _res, next) => {
        calls.push("function");
        next();
      })
      .exclude("/local")
      .forRoutes("/route");

    manager.configure(consumer);
    runMiddlewares(middlewares);

    expect(proxy.exclude).toHaveBeenCalledWith("/global", "/local");
    expect(proxy.forRoutes).toHaveBeenCalledWith("/route");
    expect(calls).toEqual(["function"]);
  });

  it("can disable global exclude routes for a middleware", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const manager = new MiddlewareManager();
    const { consumer, proxy } = createMiddlewareConsumer();

    manager
      .globalExclude("/global")
      .apply(first)
      .disableGlobalExcludeRoutes()
      .exclude("/local")
      .forRoutes("/route");

    manager.configure(consumer);

    expect(proxy.exclude).toHaveBeenCalledWith("/local");
    expect(proxy.exclude).not.toHaveBeenCalledWith("/global");
  });

  it("returns manager without registering middleware when no routes are provided", () => {
    const calls: string[] = [];
    const first = new FirstMiddleware("first", calls);
    const manager = new MiddlewareManager();

    expect(manager.apply(first).forRoutes()).toBe(manager);
    expect(collectMiddlewares(manager)).toEqual([]);
  });

  it("delegates module configuration to the middleware manager", () => {
    const configure = jest.fn();
    const manager = {
      configure,
    } as unknown as MiddlewareManager;
    const consumer = {} as MiddlewareConsumer;
    const module = new MiddlewareModule(manager);

    module.configure(consumer);

    expect(configure).toHaveBeenCalledWith(consumer);
  });
});
