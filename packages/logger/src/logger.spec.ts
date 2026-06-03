import { RequestContext } from "@nest-boot/request-context";

const mockPinoLogger = {
  child: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
};
const mockPino = jest.fn(() => mockPinoLogger);

jest.mock("pino", () => ({
  __esModule: true,
  default: mockPino,
}));

import { Logger } from "./logger";
import { BINDINGS, PINO_LOGGER } from "./logger.module-definition";

class ParentService {}

describe("Logger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("should default context to the parent class name and allow overriding it", () => {
    const logger = new Logger(new ParentService());

    expect(logger.getContext()).toBe("ParentService");

    logger.setContext("CustomContext");

    expect(logger.getContext()).toBe("CustomContext");
  });

  it("should merge bindings into request context", () => {
    jest.spyOn(RequestContext, "get").mockReturnValue({
      requestId: "request-1",
    });
    const set = jest.spyOn(RequestContext, "set").mockImplementation();
    const logger = new Logger(new ParentService());

    logger.assign({
      tenantId: "tenant-1",
    });

    expect(set).toHaveBeenCalledWith(BINDINGS, {
      requestId: "request-1",
      tenantId: "tenant-1",
    });
  });

  it("should assign bindings when request context has no existing bindings", () => {
    jest.spyOn(RequestContext, "get").mockReturnValue(undefined);
    const set = jest.spyOn(RequestContext, "set").mockImplementation();
    const logger = new Logger(new ParentService());

    logger.assign({
      tenantId: "tenant-1",
    });

    expect(set).toHaveBeenCalledWith(BINDINGS, {
      tenantId: "tenant-1",
    });
  });

  it("should log with the global pino logger when request context is inactive", () => {
    jest.spyOn(RequestContext, "get").mockImplementation(() => {
      throw new Error("Request context is not active");
    });
    const logger = new Logger(new ParentService());

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

  it("should log with request-scoped pino logger and bindings", () => {
    const requestLogger = {
      warn: jest.fn(),
    };
    jest.spyOn(RequestContext, "get").mockImplementation((token) => {
      if (token === PINO_LOGGER) return requestLogger;
      if (token === BINDINGS) {
        return {
          requestId: "request-1",
        };
      }
      return undefined;
    });
    const logger = new Logger(new ParentService());

    logger.warn("warn message");

    expect(requestLogger.warn).toHaveBeenCalledWith(
      {
        context: "ParentService",
        requestId: "request-1",
      },
      "warn message",
    );
  });

  it("should log with empty bindings when request context has no bindings", () => {
    const requestLogger = {
      debug: jest.fn(),
    };
    jest.spyOn(RequestContext, "get").mockImplementation((token) => {
      if (token === PINO_LOGGER) return requestLogger;
      return undefined;
    });
    const logger = new Logger(new ParentService());

    logger.debug("debug message");

    expect(requestLogger.debug).toHaveBeenCalledWith(
      {
        context: "ParentService",
      },
      "debug message",
    );
  });
});
