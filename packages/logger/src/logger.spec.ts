import { RequestContext } from "@nest-boot/request-context";
import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";

const {
  mockConfiguredPinoLogger,
  mockLoggerMiddleware,
  mockPino,
  mockPinoLogger,
} = vi.hoisted(() => {
  const mockPinoLogger = {
    child: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  };
  const mockPino = vi.fn(() => mockPinoLogger);
  const mockConfiguredPinoLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  };
  const mockLoggerMiddleware = {
    logger: mockConfiguredPinoLogger,
  };

  return {
    mockConfiguredPinoLogger,
    mockLoggerMiddleware,
    mockPino,
    mockPinoLogger,
  };
});

vi.mock("pino", () => ({
  __esModule: true,
  default: mockPino,
}));

import { Logger } from "./logger.js";
import {
  BINDINGS,
  PINO_HTTP,
  PINO_LOGGER,
} from "./logger.module-definition.js";

@Injectable()
class ParentService {
  constructor(readonly logger: Logger) {}
}

describe("Logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should default context to the parent class name and allow overriding it", async () => {
    const logger = await createLogger();

    expect(logger.getContext()).toBe("ParentService");

    logger.setContext("CustomContext");

    expect(logger.getContext()).toBe("CustomContext");
  });

  it("should merge bindings into request context", async () => {
    vi.spyOn(RequestContext, "get").mockReturnValue({
      requestId: "request-1",
    });
    const set = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const logger = await createLogger();

    logger.assign({
      tenantId: "tenant-1",
    });

    expect(set).toHaveBeenCalledWith(BINDINGS, {
      requestId: "request-1",
      tenantId: "tenant-1",
    });
  });

  it("should assign bindings when request context has no existing bindings", async () => {
    vi.spyOn(RequestContext, "get").mockReturnValue(undefined);
    const set = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const logger = await createLogger();

    logger.assign({
      tenantId: "tenant-1",
    });

    expect(set).toHaveBeenCalledWith(BINDINGS, {
      tenantId: "tenant-1",
    });
  });

  it("should log with the global pino logger when request context is inactive", async () => {
    vi.spyOn(RequestContext, "get").mockImplementation(() => {
      throw new Error("Request context is not active");
    });
    const logger = await createLogger();

    logger.verbose("trace message");
    logger.debug("debug message");
    logger.log("info message", { requestId: "request-1" }, "Override");
    logger.warn("warn message");
    logger.error("error message");

    expect(mockPino).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.trace).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "trace message",
    );
    expect(mockPinoLogger.debug).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "debug message",
    );
    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      {
        context: "Override",
        requestId: "request-1",
      },
      "info message",
    );
    expect(mockPinoLogger.warn).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "warn message",
    );
    expect(mockPinoLogger.error).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "error message",
    );
  });

  it("should use the module-configured logger when request context is inactive", async () => {
    vi.spyOn(RequestContext, "get").mockImplementation(() => {
      throw new Error("Request context is not active");
    });
    const logger = await createLogger(true);

    logger.log("configured message");

    expect(mockConfiguredPinoLogger.info).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "configured message",
    );
    expect(mockPino).not.toHaveBeenCalled();
  });

  it("should log with request-scoped pino logger and bindings", async () => {
    const requestLogger = {
      warn: vi.fn(),
    };
    vi.spyOn(RequestContext, "get").mockImplementation((token) => {
      if (token === PINO_LOGGER) return requestLogger;
      if (token === BINDINGS) {
        return {
          requestId: "request-1",
        };
      }
      return undefined;
    });
    const logger = await createLogger();

    logger.warn("warn message");

    expect(requestLogger.warn).toHaveBeenCalledWith(
      {
        context: "ParentService",
        requestId: "request-1",
      },
      "warn message",
    );
  });

  it("should log with empty bindings when request context has no bindings", async () => {
    const requestLogger = {
      debug: vi.fn(),
    };
    vi.spyOn(RequestContext, "get").mockImplementation((token) => {
      if (token === PINO_LOGGER) return requestLogger;
      return undefined;
    });
    const logger = await createLogger();

    logger.debug("debug message");

    expect(requestLogger.debug).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "debug message",
    );
  });
});

async function createLogger(configured = false) {
  const providers: Parameters<typeof Test.createTestingModule>[0]["providers"] =
    [Logger, ParentService];

  if (configured) {
    providers?.push({
      provide: PINO_HTTP,
      useValue: mockLoggerMiddleware,
    });
  }

  const moduleRef = await Test.createTestingModule({
    providers,
  }).compile();

  return moduleRef.get(ParentService).logger;
}
