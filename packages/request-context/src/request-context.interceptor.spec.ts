import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { lastValueFrom, Observable, of, take } from "rxjs";

import { RequestContext } from "./request-context";
import { RequestContextInterceptor } from "./request-context.interceptor";

describe("RequestContextInterceptor", () => {
  const interceptor = new RequestContextInterceptor();

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
});

function createCallHandler<T>(observable: Observable<T>): CallHandler<T> {
  return {
    handle: () => observable,
  };
}

function createExecutionContext(id: string): ExecutionContext {
  const request = {
    get: (name: string) => (name === "x-request-id" ? id : undefined),
  } as Request;

  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
