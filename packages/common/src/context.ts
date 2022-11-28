import { AsyncLocalStorage } from "async_hooks";
import { Type } from "@nestjs/common";

export class Context implements NestBootCommon.Context {
  private readonly container = new Map();

  private static readonly storage =
    new AsyncLocalStorage<NestBootCommon.Context>();

  get<T>(key: Type<T> | string | symbol): T | undefined {
    return this.container.get(key);
  }

  set<T>(key: Type<T> | string | symbol, value: T): void {
    this.container.set(key, value);
  }

  static get(): NestBootCommon.Context {
    const store = this.storage.getStore();

    if (typeof store === "undefined") {
      throw new Error("Failed to get the context");
    }

    return store;
  }

  static run<R>(ctx: NestBootCommon.Context, callback: () => R): R {
    return this.storage.run(ctx, callback);
  }
}
