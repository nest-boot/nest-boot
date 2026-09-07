import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { ModuleRef } from "@nestjs/core";
import type { Request, Response } from "express";
import { lastValueFrom, Observable, of, take } from "rxjs";

import { cookies } from "./cookies.js";
import { headers } from "./headers.js";
import { RequestContextInterceptor } from "./request-context.interceptor.js";
import { RequestContext } from "./request-context.js";

describe("RequestContextInterceptor", () => {
  class GlobalProvider {}

  const globalProvider = { source: "nest" };
  const getProvider = vi.fn((token: unknown) =>
    token === GlobalProvider ? globalProvider : undefined,
  );
  const moduleRef = {
    get: getProvider,
  } as unknown as ModuleRef;
  const interceptor = new RequestContextInterceptor(moduleRef);

  it("resolves Nest providers lazily from the active context", async () => {
    const result = await lastValueFrom(
      interceptor.intercept(createExecutionContext("provider-resolution"), {
        handle: () => of(RequestContext.get(GlobalProvider)),
      }),
    );

    expect(result).toBe(globalProvider);
    expect(getProvider).toHaveBeenCalledWith(GlobalProvider, {
      strict: false,
    });
  });

  it("prefers values stored directly in the context", async () => {
    const contextualProvider = { source: "request" };

    const result = await lastValueFrom(
      interceptor.intercept(createExecutionContext("provider-override"), {
        handle: () => {
          RequestContext.set(GlobalProvider, contextualProvider);
          return of(RequestContext.get(GlobalProvider));
        },
      }),
    );

    expect(result).toBe(contextualProvider);
  });

  it("preserves manual construction without a Nest container", async () => {
    const manualInterceptor = new RequestContextInterceptor();
    const result = await lastValueFrom(
      manualInterceptor.intercept(createExecutionContext("manual"), {
        handle: () => of(RequestContext.get(GlobalProvider)),
      }),
    );

    expect(result).toBeUndefined();
  });

  it("exposes HTTP request and response helpers in fallback contexts", async () => {
    const response = createResponse();
    const result = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext("http-helpers", {
          headers: { cookie: "session=http", "x-client": "web" },
          response,
        }),
        {
          handle: () => {
            const store = cookies();
            store.set("theme", "dark", { path: "/" });

            return of({
              client: headers().get("x-client"),
              session: store.get("session")?.value,
            });
          },
        },
      ),
    );

    expect(result).toEqual({ client: "web", session: "http" });
    expect(response.headers["set-cookie"]).toEqual(["theme=dark; Path=/"]);
  });

  it("exposes request and response helpers in GraphQL query contexts", async () => {
    const response = createResponse();
    const result = await lastValueFrom(
      interceptor.intercept(
        createGraphqlExecutionContext({
          req: createRequest("graphql-query", {
            cookie: "session=graphql",
            "x-client": "web",
          }),
          res: response as unknown as Response,
        }),
        {
          handle: () => {
            const store = cookies();
            store.set("theme", "dark", { path: "/" });

            return of({
              client: headers().get("x-client"),
              session: store.get("session")?.value,
            });
          },
        },
      ),
    );

    expect(result).toEqual({ client: "web", session: "graphql" });
    expect(response.headers["set-cookie"]).toEqual(["theme=dark; Path=/"]);
  });

  it("recovers the response from Apollo's default GraphQL request context", async () => {
    const response = createResponse();
    const request = createRequest("apollo-default", {
      cookie: "session=graphql",
    });
    request.res = response as unknown as Response;

    await lastValueFrom(
      interceptor.intercept(createGraphqlExecutionContext({ req: request }), {
        handle: () => {
          cookies().set("theme", "dark");
          return of(undefined);
        },
      }),
    );

    expect(response.headers["set-cookie"]).toEqual(["theme=dark; Path=/"]);
  });

  it("allows cookie reads but rejects writes in GraphQL subscription contexts", async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        createGraphqlExecutionContext({
          req: createRequest("graphql-subscription", {
            cookie: "session=subscription",
          }),
        }),
        {
          handle: () => {
            const store = cookies();
            let writeError: unknown;

            try {
              store.set("theme", "dark");
            } catch (error) {
              writeError = error;
            }

            return of({
              session: store.get("session")?.value,
              writeError,
            });
          },
        },
      ),
    );

    expect(result.session).toBe("subscription");
    expect(result.writeError).toEqual(
      new Error("Cookie writes require a writable HTTP response context"),
    );
  });

  it("reuses an active request context", async () => {
    const id = "active-context";

    await RequestContext.run(
      new RequestContext({ id, type: "test" }),
      async () => {
        const result = await lastValueFrom(
          interceptor.intercept(createExecutionContext("ignored"), {
            handle: () => of(RequestContext.id),
          }),
        );

        expect(result).toBe(id);
      },
    );
  });

  it("keeps the request lifecycle active through delayed emissions", async () => {
    const id = "delayed-emission";
    let lifecycleActive = false;

    RequestContext.registerMiddleware(
      "interceptor-delayed-emission-test",
      async (context, next) => {
        if (context.id !== id) {
          return await next();
        }

        lifecycleActive = true;
        try {
          return await next();
        } finally {
          lifecycleActive = false;
        }
      },
    );

    const result = await lastValueFrom(
      interceptor.intercept(
        createExecutionContext(id),
        createCallHandler(
          new Observable<{ id: string; lifecycleActive: boolean }>(
            (subscriber) => {
              setImmediate(() => {
                subscriber.next({
                  id: RequestContext.id,
                  lifecycleActive,
                });
                subscriber.complete();
              });
            },
          ),
        ),
      ),
    );

    expect(result).toEqual({ id, lifecycleActive: true });
    expect(lifecycleActive).toBe(false);
  });

  it("forwards request lifecycle rejection", async () => {
    const id = "lifecycle-rejection";
    const expected = new Error("request lifecycle failed");

    RequestContext.registerMiddleware(
      "interceptor-lifecycle-rejection-test",
      async (context, next) => {
        const result = await next();
        if (context.id === id) {
          throw expected;
        }
        return result;
      },
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(
          createExecutionContext(id),
          createCallHandler(of("value")),
        ),
      ),
    ).rejects.toBe(expected);
  });

  it("forwards source errors after finishing the request lifecycle", async () => {
    const id = "source-error";
    const expected = new Error("source failed");
    let lifecycleFinished = false;

    RequestContext.registerMiddleware(
      "interceptor-source-error-test",
      async (context, next) => {
        try {
          return await next();
        } finally {
          if (context.id === id) {
            lifecycleFinished = true;
          }
        }
      },
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(
          createExecutionContext(id),
          createCallHandler(
            new Observable<never>((subscriber) => {
              setImmediate(() => {
                subscriber.error(expected);
              });
            }),
          ),
        ),
      ),
    ).rejects.toBe(expected);
    expect(lifecycleFinished).toBe(true);
  });

  it("unsubscribes the source and finishes the lifecycle on teardown", async () => {
    const id = "subscription-teardown";
    let lifecycleFinished = false;
    let sourceTornDown = false;
    let markSourceSubscribed!: () => void;
    let markLifecycleFinished!: () => void;
    const sourceSubscribed = new Promise<void>((resolve) => {
      markSourceSubscribed = resolve;
    });
    const lifecycleFinalized = new Promise<void>((resolve) => {
      markLifecycleFinished = resolve;
    });

    RequestContext.registerMiddleware(
      "interceptor-subscription-teardown-test",
      async (context, next) => {
        try {
          return await next();
        } finally {
          if (context.id === id) {
            lifecycleFinished = true;
            markLifecycleFinished();
          }
        }
      },
    );

    const subscription = interceptor
      .intercept(
        createExecutionContext(id),
        createCallHandler(
          new Observable<never>(() => {
            markSourceSubscribed();
            return () => {
              sourceTornDown = true;
            };
          }),
        ),
      )
      .subscribe();

    await sourceSubscribed;
    await new Promise<void>((resolve) => setImmediate(resolve));

    try {
      expect(lifecycleFinished).toBe(false);
    } finally {
      subscription.unsubscribe();
    }

    await lifecycleFinalized;
    expect(sourceTornDown).toBe(true);
    expect(lifecycleFinished).toBe(true);
  });

  it("stops a synchronous source when the downstream subscriber closes", async () => {
    const id = "synchronous-teardown";
    let lifecycleFinished = false;
    let produced = 0;
    let markLifecycleFinished!: () => void;
    const lifecycleFinalized = new Promise<void>((resolve) => {
      markLifecycleFinished = resolve;
    });

    RequestContext.registerMiddleware(
      "interceptor-synchronous-teardown-test",
      async (context, next) => {
        try {
          return await next();
        } finally {
          if (context.id === id) {
            lifecycleFinished = true;
            markLifecycleFinished();
          }
        }
      },
    );

    const result = await lastValueFrom(
      interceptor
        .intercept(
          createExecutionContext(id),
          createCallHandler(
            new Observable<number>((subscriber) => {
              for (const value of [1, 2, 3]) {
                if (subscriber.closed) {
                  break;
                }
                produced++;
                subscriber.next(value);
              }
              subscriber.complete();
            }),
          ),
        )
        .pipe(take(1)),
    );

    await lifecycleFinalized;
    expect(result).toBe(1);
    expect(produced).toBe(1);
    expect(lifecycleFinished).toBe(true);
  });

  it("finishes the lifecycle when source teardown throws", async () => {
    const id = "throwing-teardown";
    const expected = new Error("source teardown failed");
    let lifecycleFinished = false;

    RequestContext.registerMiddleware(
      "interceptor-throwing-teardown-test",
      async (context, next) => {
        try {
          return await next();
        } finally {
          if (context.id === id) {
            lifecycleFinished = true;
          }
        }
      },
    );

    const subscription = interceptor
      .intercept(
        createExecutionContext(id),
        createCallHandler(
          new Observable<never>(() => {
            return () => {
              throw expected;
            };
          }),
        ),
      )
      .subscribe();

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(() => {
      subscription.unsubscribe();
    }).toThrow("source teardown failed");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(lifecycleFinished).toBe(true);
  });

  it("does not start the handler after cancellation during lifecycle startup", async () => {
    const id = "cancelled-startup";
    let continueLifecycle!: () => void;
    let markMiddlewareEntered!: () => void;
    let markMiddlewareFinished!: () => void;
    const lifecycleBarrier = new Promise<void>((resolve) => {
      continueLifecycle = resolve;
    });
    const middlewareEntered = new Promise<void>((resolve) => {
      markMiddlewareEntered = resolve;
    });
    const middlewareFinished = new Promise<void>((resolve) => {
      markMiddlewareFinished = resolve;
    });

    RequestContext.registerMiddleware(
      "interceptor-cancelled-startup-test",
      async (context, next) => {
        if (context.id !== id) {
          return await next();
        }

        markMiddlewareEntered();
        try {
          await lifecycleBarrier;
          return await next();
        } finally {
          markMiddlewareFinished();
        }
      },
    );

    const handle = vi.fn(() => of("value"));
    const handler: CallHandler<string> = { handle };
    const subscription = interceptor
      .intercept(createExecutionContext(id), handler)
      .subscribe();

    await middlewareEntered;
    subscription.unsubscribe();
    continueLifecycle();
    await middlewareFinished;

    expect(handle).not.toHaveBeenCalled();
  });

  it("forwards a synchronous handler error", async () => {
    const expected = new Error("handler failed synchronously");

    await expect(
      lastValueFrom(
        interceptor.intercept(createExecutionContext("handler-error"), {
          handle: () => {
            throw expected;
          },
        }),
      ),
    ).rejects.toBe(expected);
  });
});

function createCallHandler<T>(observable: Observable<T>): CallHandler<T> {
  return {
    handle: () => observable,
  };
}

function createExecutionContext(
  id: string,
  options: {
    headers?: Record<string, string | string[]>;
    response?: TestResponse;
  } = {},
): ExecutionContext {
  const request = createRequest(id, options.headers);

  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => options.response,
    }),
  } as unknown as ExecutionContext;
}

function createGraphqlExecutionContext(context: {
  req?: Request;
  res?: Response;
}): ExecutionContext {
  const root = { source: "graphql-root" };
  const args = { source: "graphql-args" };

  return {
    getArgByIndex: (index: number) => [root, args, context][index],
    getType: () => "graphql",
    switchToHttp: () => ({
      // Nest's ExecutionContextHost returns resolver root/args here. The
      // interceptor must read the GraphQL context at argument index 2 instead.
      getRequest: () => root,
      getResponse: () => args,
    }),
  } as unknown as ExecutionContext;
}

function createRequest(
  id: string,
  headers: Record<string, string | string[]> = {},
): Request {
  return {
    get: (name: string) =>
      name.toLowerCase() === "x-request-id" ? id : headers[name.toLowerCase()],
    headers,
  } as unknown as Request;
}

interface TestResponse {
  headers: Record<string, string | string[]>;
  headersSent: boolean;
  getHeader(name: string): string | string[] | undefined;
  setHeader(name: string, value: string | string[]): void;
}

function createResponse(): TestResponse {
  return {
    headers: {},
    headersSent: false,
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
  };
}
