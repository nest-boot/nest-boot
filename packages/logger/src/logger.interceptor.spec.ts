import { Test } from "@nestjs/testing";
import { of } from "rxjs";

import { Logger } from "./logger";
import { LoggingInterceptor } from "./logger.interceptor";

describe("LoggingInterceptor", () => {
  it("should assign route bindings for HTTP requests", async () => {
    function handler() {
      return undefined;
    }
    class TestController {}
    const assign = jest.fn();
    const handle = jest.fn(() => of("ok"));
    const interceptor = await createInterceptor(assign);
    const next = {
      handle,
    };
    const context = {
      getClass: jest.fn(() => TestController),
      getHandler: jest.fn(() => handler),
      getType: jest.fn(() => "http"),
      switchToHttp: jest.fn(() => ({
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
    const assign = jest.fn();
    const handle = jest.fn(() => of("ok"));
    const interceptor = await createInterceptor(assign);
    const next = {
      handle,
    };
    const context = {
      getType: jest.fn(() => "rpc"),
    };

    interceptor.intercept(context as never, next);

    expect(assign).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(1);
  });
});

async function createInterceptor(assign: jest.Mock) {
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
