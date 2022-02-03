import { AsyncLocalStorage } from "async_hooks";

export class Context implements NestBootCommon.Context {
  static #storage = new AsyncLocalStorage<NestBootCommon.Context>();

  constructor(context: Partial<NestBootCommon.Context>) {
    Object.entries(context).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  static get() {
    return this.#storage.getStore();
  }

  static run(store: Partial<NestBootCommon.Context>, callback: () => unknown) {
    this.#storage.run(new this(store), callback);
  }
}
