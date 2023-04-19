import { Injectable, type Type } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { AsyncLocalStorage } from "async_hooks";

type RequestContextMiddleware = (
  ctx: RequestContext,
  next?: () => Promise<void>
) => Promise<void>;

@Injectable()
export class RequestContext {
  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  private static readonly middlewares: RequestContextMiddleware[] = [];

  private static readonly composedMiddleware?: any;

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

  static async run(
    ctx: RequestContext,
    callback: RequestContextMiddleware
  ): Promise<void> {
    let i = 0;

    const next = async (): Promise<void> => {
      const middleware = this.middlewares[i++];
      typeof middleware === "undefined"
        ? await callback(ctx)
        : await middleware(ctx, next);
    };

    await this.storage.run(ctx, next);
  }

  static registerMiddleware(middleware: RequestContextMiddleware): void {
    this.middlewares.push(middleware);
  }
}
