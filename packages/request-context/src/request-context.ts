import { Injectable, Type } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { AsyncLocalStorage } from "async_hooks";

@Injectable()
export class RequestContext {
  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  constructor(private readonly discoveryService: DiscoveryService) {}

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

  static get<T>(key: string | symbol | Function | Type<T>): T {
    const store = this.storage.getStore() ?? (global as any).__requestContext;

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    return store.get(key);
  }

  static run<R>(ctx: RequestContext, callback: () => R): R {
    return this.storage.run(ctx, callback);
  }
}
