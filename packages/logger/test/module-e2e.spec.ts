import { RequestContext } from "@nest-boot/request-context";
import {
  Controller,
  type DynamicModule,
  Get,
  INestApplication,
  Injectable,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { type Logger as PinoLogger } from "pino";
import { type HttpLogger } from "pino-http";
import { Writable } from "stream";

import { Logger, LoggerModule, LoggerModuleOptions } from "../src";
import { PINO_HTTP, PINO_LOGGER } from "../src/logger.module-definition";
import { AppModule } from "./src/app.module";
import { CUSTOM_CONTENT_NAME } from "./src/constants";
import { TestService } from "./src/test.service";

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

  it("should apply pino options outside HTTP request contexts", async () => {
    const output: string[] = [];
    const stream = createOutputStream(output);
    const logger = await createConfiguredLogger({
      redact: ["secret"],
      stream,
      timestamp: false,
    });

    logger.log("outside request context", { secret: "outside-secret" });
    await RequestContext.run(
      new RequestContext({ id: "queue-context", type: "queue" }),
      () => {
        logger.log("inside queue context", { secret: "queue-secret" });
      },
    );

    const records = parseRecords(output);
    expect(records).toHaveLength(2);
    expect(records).toEqual([
      expect.objectContaining({
        context: ConfiguredLoggerConsumer.name,
        msg: "outside request context",
        secret: "[Redacted]",
      }),
      expect.objectContaining({
        context: ConfiguredLoggerConsumer.name,
        ctx: {
          id: "queue-context",
          type: "queue",
        },
        msg: "inside queue context",
        secret: "[Redacted]",
      }),
    ]);
    expect(records.every((record) => !("time" in record))).toBe(true);
  });

  it("should honor the silent level outside HTTP request contexts", async () => {
    const output: string[] = [];
    const logger = await createConfiguredLogger({
      level: "silent",
      stream: createOutputStream(output),
    });

    logger.log("outside request context");
    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      expect(RequestContext.get<PinoLogger>(PINO_LOGGER)?.level).toBe("silent");
      logger.log("inside queue context");
    });

    expect(app.get<HttpLogger>(PINO_HTTP).logger.level).toBe("silent");
    expect(output).toEqual([]);
  });

  it("should honor options when the module and logger are constructed directly", async () => {
    class Worker {}

    const output: string[] = [];
    const loggerModule = new LoggerModule({
      level: "silent",
      stream: createOutputStream(output),
    });
    loggerModule.onModuleInit();

    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      expect(RequestContext.get<PinoLogger>(PINO_LOGGER)?.level).toBe("silent");
      new Logger(new Worker()).log("directly constructed logger");
    });

    expect(output).toEqual([]);
  });

  it("should honor options for a directly constructed logger without a request context", () => {
    class Worker {}

    const output: string[] = [];
    const loggerModule = new LoggerModule({
      redact: ["secret"],
      stream: createOutputStream(output),
      timestamp: false,
    });
    loggerModule.onModuleInit();

    new Logger(new Worker()).log("direct inactive context", {
      secret: "direct-secret",
    });

    expect(parseRecords(output)).toEqual([
      expect.objectContaining({
        context: Worker.name,
        msg: "direct inactive context",
        secret: "[Redacted]",
      }),
    ]);
    expect(parseRecords(output)[0]).not.toHaveProperty("time");
  });

  it("should apply asynchronously registered options outside HTTP contexts", async () => {
    const output: string[] = [];
    const useFactory = jest.fn(async (): Promise<LoggerModuleOptions> => {
      await Promise.resolve();

      return {
        level: "silent",
        stream: createOutputStream(output),
      };
    });
    const logger = await createLoggerFromModule(
      LoggerModule.registerAsync({ useFactory }),
    );

    logger.log("outside request context");
    await RequestContext.run(new RequestContext({ type: "queue" }), () => {
      expect(RequestContext.get<PinoLogger>(PINO_LOGGER)?.level).toBe("silent");
      logger.log("inside queue context");
    });

    expect(useFactory).toHaveBeenCalledTimes(1);
    expect(app.get<HttpLogger>(PINO_HTTP).logger.level).toBe("silent");
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
