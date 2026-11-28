import { ObservabilityStorageClickhouseVNext } from "@mastra/clickhouse";
import { type Config as MastraConfig, Mastra } from "@mastra/core/mastra";
import { InMemoryStore, MastraCompositeStore } from "@mastra/core/storage";
import {
  BodyLimitMiddleware,
  JsonBodyMiddleware,
  MASTRA,
  MASTRA_OPTIONS,
  MastraExceptionFilter,
  type MastraModuleOptions as MastraCoreModuleOptions,
  MastraService,
  MastraThrottleGuard,
  RequestContextService,
  RequestTrackingInterceptor,
  RouteHandlerService,
  ShutdownService,
  StreamingInterceptor,
  TracingInterceptor,
} from "@mastra/nestjs";
import {
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";
import { PostgresStore } from "@mastra/pg";
import { createDynamicController } from "@nest-boot/common";
import {
  type DynamicModule,
  Global,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Optional,
  type Provider,
  RequestMethod,
  type Type,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { omit } from "lodash-es";

import type {
  MastraModuleAsyncOptions,
  MastraModuleOptions,
} from "./interfaces/mastra-module-options.interface.js";
import {
  MASTRA_CONTROLLER_TYPE,
  UNSUPPORTED_SERVER_KEYS,
} from "./mastra.constants.js";
import { MastraController } from "./mastra.controller.js";
import { MastraManager } from "./mastra.manager.js";
import {
  ConfigurableModuleClass,
  MASTRA_MODULE_OPTIONS,
  type OPTIONS_TYPE,
} from "./mastra.module-definition.js";
import { MastraStudioMiddleware } from "./mastra-studio.middleware.js";
import {
  normalizeMastraServerOptions,
  normalizeMastraStudioOptions,
  resolveMastraStudioBasePath,
} from "./utils/normalize-mastra-options.util.js";
import { resolveMastraControllerOptions } from "./utils/resolve-mastra-controller-options.util.js";

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Resolves a PostgreSQL connection string from `MASTRA_DATABASE_URL ?? DATABASE_URL`
 * when its protocol is `postgres:` or `postgresql:`.
 * @param mastraDatabaseUrl - Optional dedicated `MASTRA_DATABASE_URL` environment value
 * @param databaseUrl - Fallback `DATABASE_URL` environment value
 * @returns Trimmed PostgreSQL connection string, or `undefined` when absent or non-PostgreSQL
 */
function resolvePostgresDatabaseUrl(
  mastraDatabaseUrl = process.env.MASTRA_DATABASE_URL,
  databaseUrl = process.env.DATABASE_URL,
): string | undefined {
  const trimmedMastraUrl = mastraDatabaseUrl?.trim();
  const candidate =
    trimmedMastraUrl && trimmedMastraUrl.length > 0
      ? trimmedMastraUrl
      : databaseUrl?.trim();
  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate);
    return POSTGRES_PROTOCOLS.has(parsed.protocol) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parses `MASTRA_CLICKHOUSE_URL` into connection options for `ObservabilityStorageClickhouseVNext`.
 * Supports `http:`, `https:`, `clickhouse:`, and `clickhouses:` URLs with optional credentials,
 * database pathname, and query parameters.
 * @param clickhouseUrl - Raw `MASTRA_CLICKHOUSE_URL` environment value
 * @returns Normalized ClickHouse URL and credentials, or `undefined` when absent or invalid
 */
function resolveClickhouseConfig(
  clickhouseUrl = process.env.MASTRA_CLICKHOUSE_URL,
): { url: string; username: string; password: string } | undefined {
  const trimmed = clickhouseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const normalizedInput = trimmed
      .replace(/^clickhouse:\/\//i, "http://")
      .replace(/^clickhouses:\/\//i, "https://");
    const parsed = new URL(normalizedInput);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return undefined;
    }

    const username = parsed.username
      ? decodeURIComponent(parsed.username)
      : "default";
    const password = parsed.password ? decodeURIComponent(parsed.password) : "";

    parsed.username = "";
    parsed.password = "";

    return {
      url: parsed.toString(),
      username,
      password,
    };
  } catch {
    return undefined;
  }
}

/**
 * Builds the default Mastra storage from `MASTRA_DATABASE_URL ?? DATABASE_URL` (PostgreSQL)
 * and optional `MASTRA_CLICKHOUSE_URL` (ClickHouse vNext observability).
 * Returns `undefined` when neither a PostgreSQL URL nor ClickHouse URL is configured.
 * @returns Default `MastraCompositeStore` instance or `undefined`
 */
function createDefaultMastraStorage(): MastraCompositeStore | undefined {
  const connectionString = resolvePostgresDatabaseUrl();
  const postgresStore = connectionString
    ? new PostgresStore({
        id: "mastra-storage",
        connectionString,
        schemaName: "mastra",
      })
    : undefined;

  const clickhouseConfig = resolveClickhouseConfig();
  const clickhouseObservability = clickhouseConfig
    ? new ObservabilityStorageClickhouseVNext(clickhouseConfig)
    : undefined;

  if (postgresStore && clickhouseObservability) {
    return new MastraCompositeStore({
      id: "composite-storage",
      default: postgresStore,
      domains: {
        observability: clickhouseObservability,
      },
    });
  }

  if (postgresStore) {
    return postgresStore;
  }

  if (clickhouseObservability) {
    return new MastraCompositeStore({
      id: "composite-storage",
      default: new InMemoryStore(),
      domains: {
        observability: clickhouseObservability,
      },
    });
  }

  return undefined;
}

/**
 * Builds the default Mastra observability instance exporting traces to Mastra storage.
 * @returns Default `Observability` instance
 */
function createDefaultMastraObservability(): Observability {
  return new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  });
}

/**
 * Extracts `@mastra/core` constructor config from combined `MastraModuleOptions`
 * and applies built-in PostgreSQL `storage` and `observability` defaults when omitted.
 * @param options - Combined Mastra module options
 * @returns Core `Mastra` constructor config
 */
function extractMastraCoreConfig(options: MastraModuleOptions): MastraConfig {
  const { enabled: serverEnabled } = normalizeMastraServerOptions(
    options.server,
  );
  normalizeMastraStudioOptions(options.studio, serverEnabled);
  resolveMastraControllerOptions(options.server);

  if (options.server && typeof options.server === "object") {
    const rawServer = options.server as Record<string, unknown>;
    for (const key of UNSUPPORTED_SERVER_KEYS) {
      if (rawServer[key] !== undefined) {
        throw new Error(
          `MastraModule does not support server.${key}. Configure HTTP server, CORS, authentication, and custom routes through NestJS instead.`,
        );
      }
    }
  }
  const mastraConfig = omit(options, ["server", "studio"]);

  const storage = mastraConfig.storage ?? createDefaultMastraStorage();
  const observability =
    mastraConfig.observability ?? createDefaultMastraObservability();

  return {
    ...mastraConfig,
    ...(storage ? { storage } : {}),
    observability,
  };
}

/**
 * Registers Mastra Studio and server body-parsing middlewares according to resolved options.
 * @param consumer - NestJS middleware consumer
 * @param options - Resolved Mastra module options
 * @param controllerType - Dynamic `MastraController` subclass registered on the module, if any
 */
function configureMastraMiddlewares(
  consumer: MiddlewareConsumer,
  options: MastraModuleOptions,
  controllerType?: Type<MastraController>,
): void {
  const { enabled: serverEnabled, serverOptions } =
    normalizeMastraServerOptions(options.server);
  const studioOptions = normalizeMastraStudioOptions(
    options.studio,
    serverEnabled,
  );

  if (studioOptions.enabled) {
    const studioBasePath = resolveMastraStudioBasePath(serverOptions.prefix);
    consumer.apply(MastraStudioMiddleware).forRoutes(
      {
        path: studioBasePath,
        method: RequestMethod.GET,
      },
      {
        path: `${studioBasePath}/{*path}`,
        method: RequestMethod.GET,
      },
    );
  }

  if (controllerType && serverEnabled) {
    consumer
      .apply(BodyLimitMiddleware, JsonBodyMiddleware)
      .forRoutes(controllerType);
  }
}

const MASTRA_SHARED_PROVIDERS: Provider[] = [
  {
    provide: MASTRA_MODULE_OPTIONS,
    useValue: {},
  },
  {
    provide: Mastra,
    inject: [MASTRA_MODULE_OPTIONS],
    useFactory: (options: MastraModuleOptions) =>
      new Mastra(extractMastraCoreConfig(options)),
  },
  {
    provide: MASTRA,
    useExisting: Mastra,
  },
  {
    provide: MASTRA_OPTIONS,
    inject: [Mastra, MASTRA_MODULE_OPTIONS],
    useFactory: (
      mastra: Mastra,
      options: MastraModuleOptions,
    ): MastraCoreModuleOptions => ({
      ...normalizeMastraServerOptions(options.server).serverOptions,
      mastra,
      // NestJS guards own authorization; disable the upstream server auth layer.
      auth: { enabled: false },
    }),
  },
  MastraService,
  RouteHandlerService,
  RequestContextService,
  ShutdownService,
  BodyLimitMiddleware,
  JsonBodyMiddleware,
  MastraThrottleGuard,
  TracingInterceptor,
  StreamingInterceptor,
  RequestTrackingInterceptor,
  MastraExceptionFilter,
  MastraManager,
  MastraStudioMiddleware,
];

const MASTRA_SHARED_EXPORTS = [
  MASTRA_MODULE_OPTIONS,
  MASTRA,
  Mastra,
  MastraManager,
  MastraService,
];

/**
 * Global NestJS-native Mastra module.
 *
 * Runs in headless mode by default (sharing a single `Mastra` instance and
 * automatically discovering all singleton `BaseAgent` / `Agent` and
 * `BaseWorkflow` / `Workflow` providers). When `server` is enabled via `forRoot`
 * or `forRootAsync`, mounts a dynamic `MastraController` at `server.prefix`
 * (defaulting to `/api/mastra`) and bundled Mastra Studio at `${prefix}/studio`.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: MASTRA_SHARED_PROVIDERS,
  exports: MASTRA_SHARED_EXPORTS,
})
export class MastraModule
  extends ConfigurableModuleClass
  implements NestModule
{
  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    private readonly options: MastraModuleOptions,
    @Optional()
    @Inject(MASTRA_CONTROLLER_TYPE)
    private readonly controllerType?: Type<MastraController>,
  ) {
    super();
  }

  /**
   * Configures `MastraModule` synchronously. Headless unless `options.server` is
   * enabled (`true` or an options object with `enabled !== false`).
   * @param options - Synchronous Mastra module options
   * @returns Configured dynamic module
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const dynamicModule = super.forRoot(options);
    return normalizeMastraServerOptions(options.server).enabled
      ? this.withMastraController(dynamicModule)
      : dynamicModule;
  }

  /**
   * Configures `MastraModule` asynchronously. Headless unless the resolved
   * options enable `server` (`true` or an options object with `enabled !== false`).
   * @param options - Asynchronous Mastra module options
   * @returns Configured dynamic module
   */
  static override forRootAsync(
    options: MastraModuleAsyncOptions,
  ): DynamicModule {
    return this.withMastraController(super.forRootAsync(options));
  }

  private static withMastraController(
    dynamicModule: DynamicModule,
  ): DynamicModule {
    const { controller, provider } = createDynamicController(MastraController, {
      inject: [MASTRA_MODULE_OPTIONS],
      useFactory: (options: MastraModuleOptions) =>
        resolveMastraControllerOptions(options.server),
    });

    return {
      ...dynamicModule,
      controllers: [controller],
      providers: [
        ...(dynamicModule.providers ?? []),
        provider,
        {
          provide: MASTRA_CONTROLLER_TYPE,
          useExisting: provider.provide,
        },
      ],
    };
  }

  /**
   * Mounts Mastra Studio middleware at `${prefix}/studio` and Mastra JSON/body-limit
   * middleware scoped to the dynamic `MastraController` subclass when enabled.
   * @param consumer - NestJS middleware consumer
   */
  configure(consumer: MiddlewareConsumer): void {
    configureMastraMiddlewares(consumer, this.options, this.controllerType);
  }
}
