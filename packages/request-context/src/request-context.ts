import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

import { MiddlewareInstanceOrFunction } from "./interfaces";

/**
 * Manages the context for the current request execution.
 * Uses AsyncLocalStorage to persist data across async operations.
 */
export class RequestContext {
  static storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Type of middleware that can be registered in the RequestContext.
   */
  static middlewareMap = new Map<string, MiddlewareInstanceOrFunction>();

  readonly id: string;
  readonly type: string;
  private readonly map = new Map<any, any>();

  constructor(options?: { id?: string; type?: string; map?: Map<any, any> }) {
    this.id = options?.id ?? randomUUID();
    this.type = options?.type ?? "default";
    if (options?.map) {
      this.map = new Map(options.map);
    }
  }

  /**
   * Sets a value in the current context.
   *
   * @param key - The key to store the value under.
   * @param value - The value to store.
   */
  static set<T>(key: any, value: T): void {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error("RequestContext is not active");
    }

    store.set(key, value);
  }

  /**
   * Gets a value from the current context.
   *
   * @param key - The key to retrieve.
   * @returns The value stored under the key, or undefined.
   */
  static get<T>(key: any): T {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error("RequestContext is not active");
    }

    return store.get(key);
  }

  /**
   * Runs a function within the given context.
   *
   * @param ctx - The RequestContext instance.
   * @param fn - The function to run.
   * @returns The result of the function.
   */
  static run<T>(ctx: RequestContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  /**
   * Checks if a RequestContext is currently active.
   */
  static isActive(): boolean {
    return !!this.storage.getStore();
  }

  /**
   * Gets the current RequestContext ID.
   */
  static get id(): string | undefined {
    return this.storage.getStore()?.id;
  }

  /**
   * Registers a middleware to be executed when setting up the context.
   * This is typically used by other modules to attach data to the context.
   *
   * @param name - Unique name for the middleware.
   * @param middleware - The middleware function.
   */
  static registerMiddleware(
    name: string,
    middleware: MiddlewareInstanceOrFunction,
  ) {
    this.middlewareMap.set(name, middleware);
  }

  /**
   * Wraps the execution of a function with the registered middlewares in a new isolated context.
   * This ensures that changes made to the context (like setting a transaction) do not leak to the parent context.
   *
   * @param next - The function to execute after middlewares.
   */
  static async child(next: () => Promise<void>) {
    const currentStore = this.getStore();
    // Create a new context that inherits from the current one (if it exists)
    const newContext = new RequestContext({
      id: currentStore?.id,
      type: currentStore?.type,
      map: currentStore?.map,
    });

    await this.run(newContext, async () => {
      const middlewareList = Array.from(this.middlewareMap.values());

      const dispatch = async (index: number): Promise<void> => {
        if (index === middlewareList.length) {
          await next();
          return;
        }

        const middleware = middlewareList[index];

        return await (middleware as any)(
          this.getStore(),
          dispatch.bind(null, index + 1),
        );
      };

      await dispatch(0);
    });
  }

  /**
   * Gets the current store instance.
   */
  static getStore(): RequestContext | undefined {
    return this.storage.getStore();
  }

  get mapGetter() {
    return this.map;
  }

  set<T>(key: any, value: T): void {
    this.map.set(key, value);
  }

  get<T>(key: any): T {
    return this.map.get(key);
  }
}
