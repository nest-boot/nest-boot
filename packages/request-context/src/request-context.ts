import { type Type } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

/**
 * Middleware function type for request context.
 * Middlewares are executed in order when running a request context.
 *
 * @typeParam T - The return type of the middleware chain
 * @param ctx - The current request context
 * @param next - Function to call the next middleware in the chain
 * @returns A promise resolving to the result of the middleware chain
 */
type RequestContextMiddleware = <T>(
  ctx: RequestContext,
  next: () => Promise<T>,
) => Promise<T>;

/**
 * Options for creating a new RequestContext instance.
 */
export interface RequestContextCreateOptions {
  /**
   * Unique identifier for the request context.
   * If not provided, a random UUID will be generated.
   */
  id?: string;

  /**
   * The type of context (e.g., 'http', 'graphql', 'repl', 'job').
   */
  type: string;

  /**
   * Parent context for creating nested/child contexts.
   * Child contexts can access values from parent contexts.
   */
  parent?: RequestContext;
}

/**
 * RequestContext provides a way to store and access request-scoped data
 * throughout the lifecycle of a request using AsyncLocalStorage.
 *
 * This is useful for storing data like the current user, request ID,
 * database transactions, and other request-specific information that
 * needs to be accessed across different parts of the application.
 *
 * @example Basic usage
 * ```typescript
 * import { RequestContext } from '@nest-boot/request-context';
 *
 * // Get the current request ID
 * const requestId = RequestContext.id;
 *
 * // Store a value in the context
 * RequestContext.set('userId', 123);
 *
 * // Retrieve a value from the context
 * const userId = RequestContext.get<number>('userId');
 * ```
 *
 * @example Running code in a new context
 * ```typescript
 * await RequestContext.run(
 *   new RequestContext({ type: 'job' }),
 *   async (ctx) => {
 *     ctx.set('jobId', 'abc123');
 *     await processJob();
 *   }
 * );
 * ```
 *
 * @example Creating a child context
 * ```typescript
 * await RequestContext.child(async (childCtx) => {
 *   // Child context inherits values from parent
 *   // but can have its own values that don't affect parent
 *   childCtx.set('tempValue', 'only in child');
 * });
 * ```
 */
export class RequestContext {
  /**
   * Unique identifier for this request context.
   * Automatically generated as a UUID if not provided.
   */
  readonly id: string;

  /**
   * The type of this context (e.g., 'http', 'graphql', 'repl', 'job').
   */
  readonly type: string;

  /**
   * Parent context, if this is a child context.
   * Values not found in this context will be looked up in the parent.
   */
  readonly parent?: RequestContext;

  /** @internal */
  private readonly container = new Map();

  /** @internal */
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  /** @internal */
  private static readonly middlewares = new Map<
    string,
    RequestContextMiddleware
  >();

  /** @internal */
  private static readonly middlewareDependencies = new Map<string, string[]>();

  /** @internal */
  private static middlewaresStack: RequestContextMiddleware[] = [];

  /**
   * Creates a new RequestContext instance.
   *
   * @param options - Configuration options for the context
   *
   * @example
   * ```typescript
   * const ctx = new RequestContext({
   *   id: 'custom-id',
   *   type: 'http',
   * });
   * ```
   */
  constructor(options: RequestContextCreateOptions) {
    this.id = options.id ?? randomUUID();
    this.type = options.type;
    this.parent = options.parent;
  }

  /**
   * Gets a value from the context by its token.
   * If not found in this context, looks up the parent context.
   *
   * @typeParam T - The expected type of the value
   * @param token - The key to look up (string, symbol, function, or class)
   * @returns The value if found, otherwise undefined
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * const user = ctx.get<User>('currentUser');
   * const service = ctx.get(MyService);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  get<T>(token: string | symbol | Function | Type<T>): T | undefined {
    return this.container.get(token) ?? this.parent?.get(token);
  }

  /**
   * Sets a value in the context.
   *
   * @typeParam T - The type of the value
   * @param typeOrToken - The key to store the value under
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * ctx.set('userId', 123);
   * ctx.set(UserService, userServiceInstance);
   * ```
   */
  set<T>(typeOrToken: string | symbol | Type<T>, value: T): void {
    this.container.set(typeOrToken, value);
  }

  /**
   * Gets a value from the context, or sets it if not present.
   *
   * @typeParam T - The type of the value
   * @param typeOrToken - The key to look up or store under
   * @param value - The value to set if not already present
   * @returns The existing value or the newly set value
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * const cache = ctx.getOrSet('cache', new Map());
   * ```
   */
  getOrSet<T>(typeOrToken: string | symbol | Type<T>, value: T): T {
    const existing = this.get(typeOrToken);

    if (typeof existing !== "undefined") {
      return existing;
    }

    this.set(typeOrToken, value);

    return value;
  }

  /**
   * Gets a value from the current context by its key.
   * Static method that accesses the current context automatically.
   *
   * @typeParam T - The expected type of the value
   * @param key - The key to look up
   * @returns The value if found, otherwise undefined
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * const userId = RequestContext.get<number>('userId');
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  static get<T>(key: string | symbol | Function | Type<T>): T | undefined {
    const ctx = this.current();

    return ctx.get(key);
  }

  /**
   * Sets a value in the current context.
   * Static method that accesses the current context automatically.
   *
   * @typeParam T - The type of the value
   * @param key - The key to store the value under
   * @param value - The value to store
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * RequestContext.set('userId', 123);
   * ```
   */
  static set<T>(key: string | symbol | Type<T>, value: T): void {
    const ctx = this.current();

    if (typeof key !== "undefined") {
      ctx.set(key, value);
    }
  }

  /**
   * Gets a value from the current context, or sets it if not present.
   * Static method that accesses the current context automatically.
   *
   * @typeParam T - The type of the value
   * @param key - The key to look up or store under
   * @param value - The value to set if not already present
   * @returns The existing value or the newly set value
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * const cache = RequestContext.getOrSet('cache', new Map());
   * ```
   */
  static getOrSet<T>(key: string | symbol | Type<T>, value: T): T {
    const ctx = this.current();

    return ctx.getOrSet(key, value);
  }

  /**
   * Gets the ID of the current request context.
   *
   * @returns The unique identifier of the current context
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * console.log(`Processing request ${RequestContext.id}`);
   * ```
   */
  static get id() {
    return this.current().id;
  }

  /**
   * Gets the current request context.
   *
   * @returns The current RequestContext instance
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * console.log(ctx.type); // 'http'
   * ```
   */
  static current(): RequestContext {
    const ctx = this.storage.getStore();

    if (typeof ctx === "undefined") {
      throw new Error("Request context is not active");
    }

    return ctx;
  }

  /**
   * Checks if a request context is currently active.
   *
   * @returns true if a context is active, false otherwise
   *
   * @example
   * ```typescript
   * if (RequestContext.isActive()) {
   *   const userId = RequestContext.get('userId');
   * }
   * ```
   */
  static isActive(): boolean {
    return !!this.storage.getStore();
  }

  /**
   * Runs a callback within a request context.
   * All registered middlewares are executed before the callback.
   *
   * @typeParam T - The return type of the callback
   * @param ctx - The request context to run within
   * @param callback - The function to execute within the context
   * @returns A promise resolving to the callback's return value
   *
   * @example
   * ```typescript
   * const result = await RequestContext.run(
   *   new RequestContext({ type: 'job' }),
   *   async (ctx) => {
   *     ctx.set('jobId', 'abc123');
   *     return await processJob();
   *   }
   * );
   * ```
   */
  static async run<T>(
    ctx: RequestContext,
    callback: (ctx: RequestContext) => T | Promise<T>,
  ): Promise<T> {
    let i = 0;

    const next = async (): Promise<T> => {
      const middleware = this.middlewaresStack[i++];
      return typeof middleware === "undefined"
        ? await callback(ctx)
        : await middleware<T>(ctx, next);
    };

    return await this.storage.run(ctx, next);
  }

  /**
   * Creates and runs a child context that inherits from the current context.
   * Child contexts can read values from parent contexts but modifications
   * are isolated to the child.
   *
   * @typeParam T - The return type of the callback
   * @param callback - The function to execute within the child context
   * @returns A promise resolving to the callback's return value
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * // In parent context
   * RequestContext.set('userId', 123);
   *
   * await RequestContext.child(async (childCtx) => {
   *   // Can read parent values
   *   const userId = childCtx.get('userId'); // 123
   *
   *   // Child-only values don't affect parent
   *   childCtx.set('tempData', 'child only');
   * });
   *
   * // Parent context unchanged
   * RequestContext.get('tempData'); // undefined
   * ```
   */
  static async child<T>(
    callback: (ctx: RequestContext) => T | Promise<T>,
  ): Promise<T> {
    const parent = this.storage.getStore();

    if (typeof parent === "undefined") {
      throw new Error("Request context is not active");
    }

    const ctx = new RequestContext({
      id: parent.id,
      type: parent.type,
      parent,
    });

    return await this.storage.run(ctx, () => callback(ctx));
  }

  /**
   * Registers a middleware to be executed when running a request context.
   * Middlewares are executed in dependency order.
   *
   * @param name - Unique name for the middleware
   * @param middleware - The middleware function to register
   * @param dependencies - Names of middlewares that must run before this one
   *
   * @example
   * ```typescript
   * RequestContext.registerMiddleware(
   *   'auth',
   *   async (ctx, next) => {
   *     ctx.set('user', await loadUser());
   *     return next();
   *   }
   * );
   *
   * // Middleware with dependencies
   * RequestContext.registerMiddleware(
   *   'permissions',
   *   async (ctx, next) => {
   *     const user = ctx.get('user');
   *     ctx.set('permissions', await loadPermissions(user));
   *     return next();
   *   },
   *   ['auth'] // Runs after 'auth' middleware
   * );
   * ```
   */
  static registerMiddleware(
    name: string,
    middleware: RequestContextMiddleware,
    dependencies?: string[],
  ): void {
    this.middlewares.set(name, middleware);
    this.middlewareDependencies.set(name, dependencies ?? []);
    this.generateMiddlewaresStack();
  }

  /** @internal */
  private static resolveDependencies(
    name: string,
    resolved: Set<string>,
    seen: Set<string>,
  ): void {
    if (seen.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }
    seen.add(name);

    const deps = this.middlewareDependencies.get(name) ?? [];
    for (const dep of deps) {
      if (!resolved.has(dep)) {
        this.resolveDependencies(dep, resolved, seen);
      }
    }

    resolved.add(name);
  }

  /** @internal */
  private static generateMiddlewaresStack(): void {
    const resolved = new Set<string>();
    const seen = new Set<string>();

    for (const name of this.middlewares.keys()) {
      if (!resolved.has(name)) {
        this.resolveDependencies(name, resolved, seen);
      }
    }

    this.middlewaresStack = Array.from(resolved)
      .map((name) => this.middlewares.get(name))
      .filter((middleware) => typeof middleware !== "undefined");
  }
}
