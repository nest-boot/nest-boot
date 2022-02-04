import { AsyncLocalStorage } from "async_hooks";

export class Context implements NestBootCommon.Context {
  private static storage = new AsyncLocalStorage<NestBootCommon.Context>();

  constructor(context: Partial<NestBootCommon.Context>) {
    Object.entries(context).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  static get() {
    return this.storage.getStore();
  }

  static run<R>(store: Partial<NestBootCommon.Context>, callback: () => R) {
    return this.storage.run(new this(store), callback);
  }
}
