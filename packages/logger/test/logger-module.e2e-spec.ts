import { Test } from "@nestjs/testing";

const { mockLoggerMiddleware, mockPino, mockPinoHttp } = vi.hoisted(() => {
  const mockChildLogger = {
    ctx: "child",
  };
  const mockConfiguredPinoLogger = {
    child: vi.fn(() => mockChildLogger),
  };
  const mockPino = vi.fn();
  const mockLoggerMiddleware = Object.assign(
    vi.fn((req) => {
      req.log = {
        child: vi.fn(() => mockChildLogger),
      };
    }),
    { logger: mockConfiguredPinoLogger },
  );
  const mockPinoHttp = vi.fn(() => mockLoggerMiddleware);
  return {
    mockChildLogger,
    mockConfiguredPinoLogger,
    mockLoggerMiddleware,
    mockPino,
    mockPinoHttp,
  };
});

vi.mock("pino", () => ({
  __esModule: true,
  default: mockPino,
}));

vi.mock("../src/pino-http.js", () => ({
  __esModule: true,
  default: mockPinoHttp,
}));

import { LoggerModule } from "../src/logger.module.js";
import { PINO_HTTP } from "../src/logger.module-definition.js";
import { type LoggerModuleOptions } from "../src/logger-module-options.interface.js";

describe("LoggerModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
  it("should provide one configured pino-http middleware instance", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.register({ enabled: false })],
    }).compile();
    expect(moduleRef.get(PINO_HTTP)).toBe(mockLoggerMiddleware);
    expect(mockPinoHttp).toHaveBeenCalledTimes(1);
    expect(mockPinoHttp).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    await moduleRef.close();
  });
  it("should ignore options outside the public whitelist at runtime", async () => {
    const customProps = vi.fn(() => ({ unsupported: true }));
    const customReceivedMessage = vi.fn(() => "unsupported-message");
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.register({
          customLevels: { audit: 35 },
          customProps,
          customReceivedMessage,
          enabled: false,
          level: "silent",
          transport: { target: "pino-pretty" },
          useOnlyCustomLevels: true,
        } as unknown as LoggerModuleOptions),
      ],
    }).compile();
    const [options] = mockPinoHttp.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(options.enabled).toBe(false);
    expect(options).not.toHaveProperty("customLevels");
    expect(options).not.toHaveProperty("level");
    expect(options).not.toHaveProperty("transport");
    expect(options).not.toHaveProperty("useOnlyCustomLevels");
    expect(options.customProps).not.toBe(customProps);
    expect(options.customReceivedMessage).not.toBe(customReceivedMessage);
    await moduleRef.close();
  });
  it("should create the configured middleware from asynchronous options", async () => {
    const useFactory = vi.fn(async () => {
      await Promise.resolve();
      return {
        enabled: false,
        timestamp: false,
      };
    });
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.registerAsync({ useFactory })],
    }).compile();
    expect(useFactory).toHaveBeenCalledTimes(1);
    expect(moduleRef.get(PINO_HTTP)).toBe(mockLoggerMiddleware);
    expect(mockPinoHttp).toHaveBeenCalledTimes(1);
    expect(mockPinoHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        timestamp: false,
      }),
    );
    await moduleRef.close();
  });
});
