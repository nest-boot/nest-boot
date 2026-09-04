import { type InjectionToken } from "@nestjs/common";
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
export type RequestContextMiddlewareType = <T>(
  ctx: RequestContext,
  next: () => Promise<T>,
) => Promise<T>;

/**
 * Nest-compatible token used to store, resolve, or alias a request-context value.
 *
 * @typeParam T - The value associated with the token
 */
export type RequestContextToken<T = unknown> = InjectionToken<T>;

/** Resolves a dependency that is not stored directly in the context. */
export type RequestContextDependencyResolver = (
  token: RequestContextToken,
) => unknown;

/**
 * Options for creating a new RequestContext instance.
 */
export interface RequestContextCreateOptions {
  /** Lazy fallback used to resolve application dependencies. */
  dependencyResolver?: RequestContextDependencyResolver;

  /**
   * Unique identifier for the request context.
   * If not provided, a random UUID will be generated.
   */
  id?: string;

  /**
   * Application-level lifecycle category for this context.
   *
   * This value does not mirror NestJS `ExecutionContext.getType()`. Contexts
   * created by the built-in HTTP request middleware and interceptor use
   * `"http"`, including GraphQL resolver executions within a request. Other
   * integrations select categories for their lifecycle, such as `"queue"` or
   * `"repl"`; callers creating contexts directly may use categories such as
   * `"job"`.
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
   * Application-level lifecycle category for this context.
   *
   * Contexts created by the built-in HTTP request middleware and interceptor
   * use `"http"`. Other integrations may use lifecycle categories such as
   * `"queue"` or `"repl"`, and callers may define their own categories. This
   * value is independent from the NestJS execution context type.
   */
  readonly type: string;

  /**
   * Parent context, if this is a child context.
   * Values not found in this context will be looked up in the parent.
   */
  readonly parent?: RequestContext;

  /** Application dependency resolver used after contextual lookup. @internal */
  private readonly dependencyResolver?: RequestContextDependencyResolver;

  /** Internal storage map for context values. @internal */
  private readonly container = new Map();

  /** Token aliases registered directly on this context. @internal */
  private readonly aliases = new Map<
    RequestContextToken,
    RequestContextToken
  >();

  /** Async local storage backing the request context. @internal */
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  /** Registered middleware map keyed by name. @internal */
  private static readonly middlewares = new Map<
    string,
    RequestContextMiddlewareType
  >();

  /** Dependency graph for middleware ordering. @internal */
  private static readonly middlewareDependencies = new Map<string, string[]>();

  /** Topologically-sorted middleware execution stack. @internal */
  private static middlewaresStack: RequestContextMiddlewareType[] = [];

  /** Creates a new RequestContext instance.
   * @param options - Options for creating the request context (id, type, parent)
   */
  constructor(options: RequestContextCreateOptions) {
    this.id = options.id ?? randomUUID();
    this.type = options.type;
    this.parent = options.parent;
    this.dependencyResolver = options.dependencyResolver;

    if (this.parent) {
      for (const [aliasToken, targetToken] of this.parent.aliases) {
        this.aliases.set(aliasToken, targetToken);
      }
    }
  }

  /**
   * Gets a value from the context by its token.
   * Alias tokens are resolved to their final canonical token. If no value is
   * found in this context, the parent context and dependency resolver are used.
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
  get<T>(token: RequestContextToken<T>): T | undefined {
    const resolvedToken = this.resolveToken(token);
    const contextValue = this.findContextValue(resolvedToken);

    if (contextValue.found) {
      return contextValue.value as T | undefined;
    }

    return this.resolveDependency(resolvedToken) as T | undefined;
  }

  /** Finds an explicitly stored value without resolving aliases or providers. */
  private findContextValue(token: RequestContextToken): {
    found: boolean;
    value: unknown;
  } {
    if (this.container.has(token)) {
      return {
        found: true,
        value: this.container.get(token),
      };
    }

    return (
      this.parent?.findContextValue(token) ?? {
        found: false,
        value: undefined,
      }
    );
  }

  /** Resolves a dependency through parent resolvers before the local resolver. */
  private resolveDependency(token: RequestContextToken): unknown {
    const parentValue = this.parent?.resolveDependency(token);

    if (typeof parentValue !== "undefined") {
      return parentValue;
    }

    return this.dependencyResolver?.(token);
  }

  /** Gets the effective alias target for a token in this context hierarchy. */
  private getAliasTarget(
    aliasToken: RequestContextToken,
  ): RequestContextToken | undefined {
    return this.aliases.get(aliasToken);
  }

  /** Resolves an alias chain and rejects circular aliases. */
  private resolveToken(aliasToken: RequestContextToken): RequestContextToken {
    const path = [aliasToken];
    const seen = new Map<RequestContextToken, number>([[aliasToken, 0]]);
    let token = aliasToken;

    while (true) {
      const targetToken = this.getAliasTarget(token);

      if (typeof targetToken === "undefined") {
        return token;
      }

      path.push(targetToken);

      const cycleStart = seen.get(targetToken);

      if (typeof cycleStart !== "undefined") {
        const cycle = path
          .slice(cycleStart)
          .map((currentToken) => RequestContext.formatToken(currentToken))
          .join(" -> ");

        throw new Error(`Circular request context alias detected: ${cycle}`);
      }

      seen.set(targetToken, path.length - 1);
      token = targetToken;
    }
  }

  /** Formats a token for use in alias validation errors. */
  private static formatToken(token: RequestContextToken): string {
    if (typeof token === "string") {
      return JSON.stringify(token);
    }

    if (typeof token === "symbol") {
      return token.toString();
    }

    return token.name || "(anonymous function)";
  }

  /**
   * Sets a value in the context.
   * Alias tokens are resolved to their final canonical token before storage.
   *
   * @typeParam T - The type of the value
   * @param typeOrToken - The token to resolve and store the value under
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * ctx.set('userId', 123);
   * ctx.set(UserService, userServiceInstance);
   * ```
   */
  set<T>(typeOrToken: RequestContextToken<T>, value: T): void {
    this.container.set(this.resolveToken(typeOrToken), value);
  }

  /**
   * Registers an alias for another token in this context.
   * The alias token is resolved to the canonical target token. Child contexts
   * snapshot inherited aliases when they are created and may override them
   * without modifying their parent.
   *
   * @param aliasToken - The token consumers use to request the value
   * @param targetToken - The canonical token that provides the value
   * @throws Error if the alias would create a circular alias chain
   *
   * @example
   * ```typescript
   * context.alias(BaseUser, User);
   * context.set(BaseUser, user);
   * context.get(User); // user
   * ```
   */
  alias(
    aliasToken: RequestContextToken,
    targetToken: RequestContextToken,
  ): void {
    const hadAlias = this.aliases.has(aliasToken);
    const previousTarget = this.aliases.get(aliasToken);

    this.aliases.set(aliasToken, targetToken);

    try {
      this.resolveToken(aliasToken);
    } catch (error) {
      if (hadAlias && typeof previousTarget !== "undefined") {
        this.aliases.set(aliasToken, previousTarget);
      } else {
        this.aliases.delete(aliasToken);
      }

      throw error;
    }
  }

  /**
   * Cancels an alias in this context.
   * An inherited alias is removed only from this context; existing parent and
   * child snapshots remain unchanged. Registering the alias again re-enables it.
   *
   * @param aliasToken - The alias token to cancel
   *
   * @example
   * ```typescript
   * context.unalias(BaseUser);
   * ```
   */
  unalias(aliasToken: RequestContextToken): void {
    this.aliases.delete(aliasToken);
  }

  /**
   * Gets a value from the context, or sets it if not present.
   * Alias tokens are resolved to the same canonical token for both operations.
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
  getOrSet<T>(typeOrToken: RequestContextToken<T>, value: T): T {
    const existing = this.get<T>(typeOrToken);

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
  static get<T>(key: RequestContextToken<T>): T | undefined {
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
  static set<T>(key: RequestContextToken<T>, value: T): void {
    const ctx = this.current();

    if (typeof key !== "undefined") {
      ctx.set(key, value);
    }
  }

  /**
   * Registers a token alias in the current context.
   *
   * @param aliasToken - The token consumers use to request the value
   * @param targetToken - The canonical token that provides the value
   * @throws Error if no request context is active or the alias creates a cycle
   *
   * @example
   * ```typescript
   * RequestContext.alias(BaseUser, User);
   * ```
   */
  static alias(
    aliasToken: RequestContextToken,
    targetToken: RequestContextToken,
  ): void {
    this.current().alias(aliasToken, targetToken);
  }

  /**
   * Cancels a token alias in the current context.
   *
   * @param aliasToken - The alias token to cancel
   * @throws Error if no request context is active
   *
   * @example
   * ```typescript
   * RequestContext.unalias(BaseUser);
   * ```
   */
  static unalias(aliasToken: RequestContextToken): void {
    this.current().unalias(aliasToken);
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
  static getOrSet<T>(key: RequestContextToken<T>, value: T): T {
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
    middleware: RequestContextMiddlewareType,
    dependencies?: string[],
  ): void {
    this.middlewares.set(name, middleware);
    this.middlewareDependencies.set(name, dependencies ?? []);
    this.generateMiddlewaresStack();
  }

  /** Resolves middleware dependencies via topological sort. @internal */
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

  /** Rebuilds the middleware execution stack after registration changes. @internal */
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
