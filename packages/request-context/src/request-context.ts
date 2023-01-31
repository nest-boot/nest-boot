import { Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { UnknownElementException } from "@nestjs/core/errors/exceptions";
import { AsyncLocalStorage } from "async_hooks";

export class RequestContext {
  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  constructor(private readonly moduleRef: ModuleRef) {}

  async create<T>(type: Type<T>): Promise<T> {
    return await this.moduleRef.create(type);
  }

  get<T>(typeOrToken: string | symbol | Function | Type<T>): T {
    if (typeOrToken === ModuleRef) {
      return this.moduleRef as any;
    }

    let service = this.container.get(typeOrToken);

    if (typeof service === "undefined") {
      try {
        service = this.moduleRef.get(typeOrToken);
      } catch (err) {
        if (!(err instanceof UnknownElementException)) {
          throw err;
        }
      }
    }

    return service;
  }

  set<T>(typeOrToken: string | symbol | Type<T>, value?: T): void {
    typeof typeOrToken !== "string" &&
    typeof typeOrToken !== "symbol" &&
    typeof value === "undefined"
      ? this.container.set(typeOrToken, this.create(typeOrToken))
      : this.container.set(typeOrToken, value);
  }

  static set<T>(key: string | symbol | Type<T>, value: T): void {
    const store = this.storage.getStore();

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    if (typeof key !== "undefined") {
      store.set(key, value);
    }
  }

  static get<T>(key: string | symbol | Function | Type<T>): T {
    const store = this.storage.getStore();

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    return store.get(key);
  }

  static run<R>(ctx: RequestContext, callback: () => R): R {
    return this.storage.run(ctx, callback);
  }
}
