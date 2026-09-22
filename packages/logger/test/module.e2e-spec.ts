import { Writable } from "node:stream";

import { RequestContext } from "@nest-boot/request-context";
import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  Injectable,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";

import {
  Logger,
  LoggerModule,
  type LoggerModuleOptions,
} from "../src/index.js";
import { AppModule } from "./src/app.module.js";
import { CUSTOM_CONTENT_NAME } from "./src/constants.js";
import { TestService } from "./src/test.service.js";

@Injectable()
class ConfiguredLoggerConsumer {
  constructor(readonly logger: Logger) {}
}

@Controller("logger")
class ConfiguredLoggerController {
  constructor(private readonly logger: Logger) {}

  @Get()
  log(): { ok: true } {
    this.logger.log("inside HTTP context", { secret: "http-secret" });

    return { ok: true };
  }
}

describe("LoggerModule - e2e", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
  });

  it(`default context name should be the class name`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.defaultContextName).toEqual(TestService.name);
  });

  it(`reading context after setting it should match the set value`, async () => {
    const testService = app.get(TestService);
    await app.init();

    expect(testService.customContextName).toEqual(CUSTOM_CONTENT_NAME);
  });

  it("should apply supported options outside HTTP request contexts", async () => {
    const output: string[] = [];
    const stream = createOutputStream(output);
    const logger = await createConfiguredLogger({
      formatters: {
        level: (label) => ({ severity: label }),
      },
      redact: ["secret"],
      serializers: {
        account: (account: { id: string }) => ({ id: account.id }),
      },
      stream,
      timestamp: false,
    });

    logger.log("outside request context", {
      account: { id: "outside-account", secret: "account-secret" },
      secret: "outside-secret",
    });
    await RequestContext.run(
      new RequestContext({ id: "queue-context", type: "queue" }),
      () => {
        logger.log("inside queue context", {
          account: { id: "queue-account", secret: "account-secret" },
          secret: "queue-secret",
        });
      },
    );

    const records = parseRecords(output);
    expect(records).toHaveLength(2);
    expect(records).toEqual([
      expect.objectContaining({
        account: { id: "outside-account" },
        context: ConfiguredLoggerConsumer.name,
        msg: "outside request context",
        secret: "[Redacted]",
        severity: "info",
      }),
      expect.objectContaining({
        account: { id: "queue-account" },
        context: ConfiguredLoggerConsumer.name,
        ctx: {
          id: "queue-context",
          type: "queue",
        },
        msg: "inside queue context",
        secret: "[Redacted]",
        severity: "info",
      }),
    ]);
    expect(records.every((record) => !("time" in record))).toBe(true);
  });

  it.each(["fallback", "request"])(
    "preserves Nest error arguments in the %s logger",
    async (mode) => {
      const output: string[] = [];
      const logger = await createConfiguredLogger({
        stream: createOutputStream(output),
        timestamp: false,
      });
      const error = new Error("operation failed");
      const stack = error.stack;
      if (!stack) throw new Error("Expected the test Error to have a stack");
      const logErrors = () => {
        logger.error("explicit stack", stack, "OrdersService");
        logger.error("stack only", stack);
        logger.error("context only", "OrdersService");
        logger.error(
          "structured error",
          { err: error, orderId: "42" },
          "OrdersService",
        );
        logger.error(error, { orderId: "42" }, "OrdersService");
        logger.error("error parameter", error, "OrdersService");
        logger.error("missing stack", undefined, "OrdersService");
        logger.error("opaque stack", "trace text", "OrdersService");
        logger.error("trailing stack", "OrdersService", stack);
        logger.error(
          "metadata and stack",
          { orderId: "42" },
          stack,
          "OrdersService",
        );
        logger.error(
          "metadata and opaque stack",
          { orderId: "42" },
          "trace text",
          "OrdersService",
        );
        logger.error(
          "stack before metadata",
          stack,
          { orderId: "42" },
          "OrdersService",
        );
      };
      if (mode === "request") {
        await RequestContext.run(
          new RequestContext({ type: "queue" }),
          logErrors,
        );
      } else {
        logErrors();
      }

      const records = parseRecords(output);
      const serializedError = expect.objectContaining({
        message: error.message,
        stack,
      });
      expect(records).toEqual([
        expect.objectContaining({
          msg: "explicit stack",
          stack,
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "stack only",
          stack,
          context: ConfiguredLoggerConsumer.name,
        }),
        expect.objectContaining({
          msg: "context only",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "structured error",
          err: serializedError,
          orderId: "42",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: error.message,
          err: serializedError,
          orderId: "42",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "error parameter",
          err: serializedError,
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "missing stack",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "opaque stack",
          stack: "trace text",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "trailing stack",
          stack,
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "metadata and stack",
          orderId: "42",
          stack,
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "metadata and opaque stack",
          orderId: "42",
          stack: "trace text",
          context: "OrdersService",
        }),
        expect.objectContaining({
          msg: "stack before metadata",
          orderId: "42",
          stack,
          context: "OrdersService",
        }),
      ]);
      expect(records[2]).not.toHaveProperty("stack");
      expect(records[6]).not.toHaveProperty("stack");
    },
  );

  it("should honor disabled logging outside HTTP request contexts", async () => {
    const output: string[] = [];
    const logger = await createConfiguredLogger({
      enabled: false,
      stream: createOutputStream(output),
    });

    logger.log("outside request context");
    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      logger.log("inside queue context");
    });

    expect(output).toEqual([]);
  });

  it("should honor options when the module and logger are constructed directly", async () => {
    class Worker {}

    const output: string[] = [];
    const loggerModule = new LoggerModule({
      enabled: false,
      stream: createOutputStream(output),
    });
    loggerModule.onModuleInit();

    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      new Logger(new Worker()).log("directly constructed logger");
    });

    expect(output).toEqual([]);
  });

  it("should apply asynchronously registered options outside HTTP contexts", async () => {
    const output: string[] = [];
    const useFactory = vi.fn(async (): Promise<LoggerModuleOptions> => {
      await Promise.resolve();

      return {
        enabled: false,
        stream: createOutputStream(output),
      };
    });
    const logger = await createLoggerFromModule(
      LoggerModule.registerAsync({ useFactory }),
    );

    logger.log("outside request context");
    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      logger.log("inside queue context");
    });

    expect(useFactory).toHaveBeenCalledTimes(1);
    expect(output).toEqual([]);
  });

  it("should preserve configured logging for HTTP request contexts", async () => {
    const output: string[] = [];
    await createConfiguredLogger({
      autoLogging: false,
      redact: ["secret"],
      stream: createOutputStream(output),
      timestamp: false,
    });
    await app.listen(0);

    const response = await fetch(`${await app.getUrl()}/logger`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(parseRecords(output)).toEqual([
      expect.objectContaining({
        context: ConfiguredLoggerController.name,
        ctx: expect.objectContaining({ type: "http" }),
        msg: "inside HTTP context",
        secret: "[Redacted]",
      }),
    ]);
    expect(parseRecords(output)[0]).not.toHaveProperty("time");
  });

  afterEach(async () => {
    await app.close();
  });

  async function createConfiguredLogger(
    options: LoggerModuleOptions,
  ): Promise<Logger> {
    return await createLoggerFromModule(LoggerModule.register(options));
  }

  async function createLoggerFromModule(
    loggerModule: DynamicModule,
  ): Promise<Logger> {
    await app.close();

    const module = await Test.createTestingModule({
      imports: [loggerModule],
      controllers: [ConfiguredLoggerController],
      providers: [ConfiguredLoggerConsumer],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    return app.get(ConfiguredLoggerConsumer).logger;
  }
});

function createOutputStream(output: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });
}

function parseRecords(output: string[]): Record<string, unknown>[] {
  return output
    .join("")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((record) => JSON.parse(record) as Record<string, unknown>);
}
