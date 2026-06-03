import { REQUEST, RequestContext, RESPONSE } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";

const mockChildLogger = {
  ctx: "child",
};
const mockPinoLogger = {
  child: jest.fn(() => mockChildLogger),
};
const mockPino = jest.fn(() => mockPinoLogger);
const mockLoggerMiddleware = jest.fn((req) => {
  req.log = {
    child: jest.fn(() => mockChildLogger),
  };
});
const mockPinoHttp = jest.fn(() => mockLoggerMiddleware);

jest.mock("pino", () => ({
  __esModule: true,
  default: mockPino,
}));
jest.mock("pino-http", () => ({
  __esModule: true,
  default: mockPinoHttp,
}));

import { LoggerModule } from "./logger.module";
import { MODULE_OPTIONS_TOKEN, PINO_LOGGER } from "./logger.module-definition";
import { type LoggerModuleOptions } from "./logger-module-options.interface";

describe("LoggerModule", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("should register synchronous and asynchronous options", () => {
    const options = {
      autoLogging: false,
    };
    const dynamicModule = LoggerModule.register(options);
    const useFactory = () => options;
    const asyncModule = LoggerModule.registerAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(LoggerModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
    expect(asyncModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("should apply defaults while preserving supplied options", async () => {
    const module = await createLoggerModule({
      autoLogging: {
        ignore: () => false,
      },
      customProps: () => ({
        custom: true,
      }),
      genReqId: () => "custom-id",
    });
    const options = (module as unknown as { options: any }).options;

    expect(options.redact).toEqual([
      "req.headers.authorization",
      "req.headers.cookie",
    ]);
    expect(options.genReqId()).toBe("custom-id");
    expect(options.customReceivedMessage()).toBe("request received");
    expect(options.customProps()).toEqual({
      custom: true,
    });
  });

  it("should configure default request id, props, and auto logging behavior", async () => {
    const module = await createLoggerModule();
    const options = (module as unknown as { options: any }).options;
    jest.spyOn(RequestContext, "isActive").mockReturnValue(true);
    jest.spyOn(RequestContext, "get").mockReturnValue({
      tenantId: "tenant-1",
    });
    jest.spyOn(RequestContext, "id", "get").mockReturnValue("ctx-id");

    process.env.NODE_ENV = "test";

    expect(
      options.autoLogging.ignore({
        headers: {
          "x-logging": "false",
        },
      }),
    ).toBe(true);
    expect(
      options.autoLogging.ignore({
        headers: {},
      }),
    ).toBe(false);
    expect(options.genReqId()).toBe("ctx-id");
    expect(options.customProps()).toEqual({
      tenantId: "tenant-1",
    });
  });

  it("should cover fallback defaults for boolean auto logging and inactive context", async () => {
    const module = await createLoggerModule({
      autoLogging: false,
    });
    const options = (module as unknown as { options: any }).options;
    jest.spyOn(RequestContext, "isActive").mockReturnValueOnce(false);
    jest
      .spyOn(RequestContext, "id", "get")
      .mockReturnValue(undefined as unknown as string);

    expect(options.autoLogging).toBe(false);
    expect(options.customProps()).toEqual({});
    expect(options.genReqId()).toEqual(expect.any(String));
  });

  it("should return empty custom props when bindings are not set", async () => {
    const module = await createLoggerModule();
    const options = (module as unknown as { options: any }).options;
    jest.spyOn(RequestContext, "isActive").mockReturnValue(true);
    jest.spyOn(RequestContext, "get").mockReturnValue(undefined);

    expect(options.customProps()).toEqual({});
  });

  it("should emit decorator metadata when options exist at runtime", () => {
    jest.isolateModules(() => {
      jest.doMock("./logger-module-options.interface", () => ({
        LoggerModuleOptions: class LoggerModuleOptions {
          static readonly marker = true;
        },
      }));

      expect(
        jest.requireActual<typeof import("./logger.module")>("./logger.module")
          .LoggerModule,
      ).toBeDefined();
      jest.dontMock("./logger-module-options.interface");
    });
  });

  it("should register pino logger middleware for requests", async () => {
    const module = await createLoggerModule();
    const registerMiddleware = jest
      .spyOn(RequestContext, "registerMiddleware")
      .mockImplementation();

    module.onModuleInit();

    const middleware = registerMiddleware.mock.calls[0][1];
    const req = {};
    const res = {};
    const ctx = {
      get: jest.fn((token) => {
        if (token === REQUEST) return req;
        if (token === RESPONSE) return res;
        return undefined;
      }),
      id: "ctx-id",
      set: jest.fn(),
      type: "http",
    };
    const next = jest.fn().mockResolvedValue("next-result");

    await expect(middleware(ctx as never, next)).resolves.toBe("next-result");

    expect(mockLoggerMiddleware).toHaveBeenCalledWith(req, res);
    expect(ctx.set).toHaveBeenCalledWith(PINO_LOGGER, mockChildLogger);
  });

  it("should register fallback pino logger middleware without request objects", async () => {
    const module = await createLoggerModule();
    const registerMiddleware = jest
      .spyOn(RequestContext, "registerMiddleware")
      .mockImplementation();

    module.onModuleInit();

    const middleware = registerMiddleware.mock.calls[0][1];
    const ctx = {
      get: jest.fn(() => undefined),
      id: "ctx-id",
      set: jest.fn(),
      type: "job",
    };
    const next = jest.fn().mockResolvedValue("next-result");

    await expect(middleware(ctx as never, next)).resolves.toBe("next-result");

    expect(mockPinoLogger.child).toHaveBeenCalledWith({
      ctx: {
        id: "ctx-id",
        type: "job",
      },
    });
    expect(ctx.set).toHaveBeenCalledWith(PINO_LOGGER, mockChildLogger);
  });
});

async function createLoggerModule(options?: LoggerModuleOptions) {
  const providers: Parameters<typeof Test.createTestingModule>[0]["providers"] =
    [LoggerModule];

  if (typeof options !== "undefined") {
    providers?.push({
      provide: MODULE_OPTIONS_TOKEN,
      useValue: options,
    });
  }

  const moduleRef = await Test.createTestingModule({
    providers,
  }).compile();

  return moduleRef.get(LoggerModule);
}
