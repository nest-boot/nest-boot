import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import type { Mock } from "vitest";

import { LoggingInterceptor } from "./logger.interceptor.js";
import { Logger } from "./logger.js";

describe("LoggingInterceptor", () => {
  it("should assign route bindings for HTTP requests", async () => {
    function handler() {
      return undefined;
    }
    class TestController {}
    const assign = vi.fn();
    const handle = vi.fn(() => of("ok"));
    const interceptor = await createInterceptor(assign);
    const next = {
      handle,
    };
    const context = {
      getClass: vi.fn(() => TestController),
      getHandler: vi.fn(() => handler),
      getType: vi.fn(() => "http"),
      switchToHttp: vi.fn(() => ({
        getRequest: () => ({
          route: {
            path: "/test",
          },
        }),
      })),
    };

    interceptor.intercept(context as never, next).subscribe();

    expect(assign).toHaveBeenCalledWith({
      route: {
        controller: "TestController",
        handler: "handler",
        path: "/test",
      },
    });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("should skip route bindings for non-HTTP requests", async () => {
    const assign = vi.fn();
    const handle = vi.fn(() => of("ok"));
    const interceptor = await createInterceptor(assign);
    const next = {
      handle,
    };
    const context = {
      getType: vi.fn(() => "rpc"),
    };

    interceptor.intercept(context as never, next);

    expect(assign).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(1);
  });
});

async function createInterceptor(assign: Mock) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      LoggingInterceptor,
      {
        provide: Logger,
        useValue: {
          assign,
        },
      },
    ],
  }).compile();

  return moduleRef.get(LoggingInterceptor);
}
