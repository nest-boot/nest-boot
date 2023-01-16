import { Type } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";

export class RequestContext {
  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  get<T>(key: Type<T> | string | symbol): T | undefined {
    return this.container.get(key);
  }

  set<T>(key: Type<T> | string | symbol, value: T): void {
    this.container.set(key, value);
  }

  static set<T>(key: Type<T> | string | symbol, value: T): void {
    const store = this.storage.getStore();

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    if (typeof key !== "undefined") {
      store.set(key, value);
    }
  }

  static get(): RequestContext;
  static get<T>(key: Type<T> | string | symbol): T | undefined;
  static get<T>(
    key?: Type<T> | string | symbol
  ): T | RequestContext | undefined {
    const store = this.storage.getStore();

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    if (typeof key !== "undefined") {
      return store.get(key);
    }

    return store;
  }

  static run<R>(ctx: RequestContext, callback: () => R): R {
    return this.storage.run(ctx, callback);
  }
}
