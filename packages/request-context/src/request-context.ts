import { Injectable, type Type } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { AsyncLocalStorage } from "async_hooks";

type RequestContextMiddleware = (
  ctx: RequestContext,
  next?: () => Promise<void> | void
) => Promise<void> | void;

const compose = (
  middleware: RequestContextMiddleware[]
): RequestContextMiddleware => {
  return function (context, next) {
    // last called middleware #
    let index = -1;
    return dispatch(0);
    function dispatch(i: number): any {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }

      index = i;
      let fn = middleware[i];
      if (i === middleware.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        fn = next!;
      }

      if (typeof fn === "undefined") {
        return Promise.resolve();
      }

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
};

@Injectable()
export class RequestContext {
  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  private static readonly middlewares: RequestContextMiddleware[] = [];

  constructor(private readonly discoveryService: DiscoveryService) {}

  // eslint-disable-next-line @typescript-eslint/ban-types
  get<T>(token: string | symbol | Function | Type<T>): T {
    if (token === DiscoveryService) {
      return this.discoveryService as any;
    }

    let service = this.container.get(token);

    if (typeof service === "undefined") {
      service = this.discoveryService
        .getProviders()
        .find((wrapper) => wrapper.token === token)?.instance;
    }

    return service;
  }

  set<T>(typeOrToken: string | symbol | Type<T>, value: T): void {
    this.container.set(typeOrToken, value);
  }

  static set<T>(key: string | symbol | Type<T>, value: T): void {
    const store = this.storage.getStore() ?? (global as any).__requestContext;

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    if (typeof key !== "undefined") {
      store.set(key, value);
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static get<T>(key: string | symbol | Function | Type<T>): T {
    const store = this.storage.getStore() ?? (global as any).__requestContext;

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    return store.get(key);
  }

  static run(
    ctx: RequestContext,
    callback: RequestContextMiddleware
  ): Promise<void> | void {
    const composedMiddleware = compose([...this.middlewares, callback]);

    return this.storage.run(ctx, async () => {
      await composedMiddleware(ctx);
    });
  }

  static registerMiddleware(middleware: RequestContextMiddleware): void {
    this.middlewares.push(middleware);
  }
}
