import { Injectable, type Type } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

type RequestContextMiddleware = <T>(
  ctx: RequestContext,
  next: () => Promise<T>,
) => Promise<T>;

export interface RequestContextCreateOptions {
  id?: string;
  type: string;
}

@Injectable()
export class RequestContext {
  readonly id: string;

  readonly type: string;

  private readonly container = new Map();

  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  private static readonly middlewares: RequestContextMiddleware[] = [];

  constructor(options: RequestContextCreateOptions) {
    this.id = options.id ?? randomUUID();
    this.type = options.type;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  get<T>(token: string | symbol | Function | Type<T>): T | undefined {
    return this.container.get(token);
  }

  set<T>(typeOrToken: string | symbol | Type<T>, value: T): void {
    this.container.set(typeOrToken, value);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static get<T>(key: string | symbol | Function | Type<T>): T | undefined {
    const ctx = this.storage.getStore();

    if (typeof ctx === "undefined") {
      throw new Error("Request context is not active");
    }

    return ctx.get(key);
  }

  static set<T>(key: string | symbol | Type<T>, value: T): void {
    const ctx = this.storage.getStore();

    if (typeof ctx === "undefined") {
      throw new Error("Request context is not active");
    }

    if (typeof key !== "undefined") {
      ctx.set(key, value);
    }
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
      const middleware = this.middlewares[i++];
      return typeof middleware === "undefined"
        ? await callback(ctx)
        : await middleware<T>(ctx, next);
    };

    return await this.storage.run(ctx, next);
  }

  static registerMiddleware(middleware: RequestContextMiddleware): void {
    this.middlewares.push(middleware);
  }
}
