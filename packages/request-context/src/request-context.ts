import { Injectable, type Type } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { AsyncLocalStorage } from "async_hooks";

type RequestContextMiddleware = <T>(
  ctx: RequestContext,
  next: () => Promise<T>
) => Promise<T>;

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

  static async run<T>(
    ctx: RequestContext,
    callback: (ctx: RequestContext) => T | Promise<T>
  ): Promise<T> {
    let i = 0;

    const next = async (): Promise<T> => {
      const middleware = this.middlewares[i++];
      return typeof middleware === "undefined"
        ? await callback(ctx)
        : await middleware<T>(ctx, next);
    };

    return await this.storage.run(ctx, next);
  }

  static registerMiddleware(middleware: RequestContextMiddleware): void {
    this.middlewares.push(middleware);
  }
}
