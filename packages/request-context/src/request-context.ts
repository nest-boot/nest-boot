import { type Type } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

type RequestContextMiddleware = <T>(
  ctx: RequestContext,
  next: () => Promise<T>,
) => Promise<T>;

export interface RequestContextCreateOptions {
  id?: string;
  type: string;
  parent?: RequestContext;
}

export class RequestContext {
  readonly id: string;

  readonly type: string;

  readonly parent?: RequestContext;

  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  private static readonly middlewares = new Map<
    string,
    RequestContextMiddleware
  >();

  private static readonly middlewareDependencies = new Map<string, string[]>();

  private static middlewaresStack: RequestContextMiddleware[] = [];

  constructor(options: RequestContextCreateOptions) {
    this.id = options.id ?? randomUUID();
    this.type = options.type;
    this.parent = options.parent;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  get<T>(token: string | symbol | Function | Type<T>): T | undefined {
    return this.container.get(token) ?? this.parent?.get(token);
  }

  set<T>(typeOrToken: string | symbol | Type<T>, value: T): void {
    this.container.set(typeOrToken, value);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static get<T>(key: string | symbol | Function | Type<T>): T | undefined {
    const ctx = this.current();

    return ctx.get(key);
  }

  static set<T>(key: string | symbol | Type<T>, value: T): void {
    const ctx = this.current();

    if (typeof key !== "undefined") {
      ctx.set(key, value);
    }
  }

  static current(): RequestContext {
    const ctx = this.storage.getStore();

    if (typeof ctx === "undefined") {
      throw new Error("Request context is not active");
    }

    return ctx;
  }

  static isActive(): boolean {
    return !!this.storage.getStore();
  }

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

  static registerMiddleware(
    name: string,
    middleware: RequestContextMiddleware,
    dependencies?: string[],
  ): void {
    this.middlewares.set(name, middleware);
    this.middlewareDependencies.set(name, dependencies ?? []);
    this.generateMiddlewaresStack();
  }

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
