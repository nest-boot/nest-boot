import { ObservabilityStorageClickhouseVNext } from "@mastra/clickhouse";
import { type Config as MastraConfig, Mastra } from "@mastra/core/mastra";
import { InMemoryStore, MastraCompositeStore } from "@mastra/core/storage";
import {
  AuthService,
  BodyLimitMiddleware,
  CustomRouteService,
  JsonBodyMiddleware,
  MASTRA,
  MASTRA_OPTIONS,
  MastraAuthGuard,
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
import {
  type DynamicModule,
  Global,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
  RequestMethod,
} from "@nestjs/common";
import { DiscoveryModule, ModulesContainer, RouterModule } from "@nestjs/core";

import { MastraController } from "./mastra.controller.js";
import { MastraManager } from "./mastra.manager.js";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MASTRA_MODULE_OPTIONS,
  type MastraModuleOptions,
  normalizeMastraApiOptions,
  normalizeMastraStudioOptions,
  type OPTIONS_TYPE,
  resolveMastraStudioBasePath,
} from "./mastra.module-definition.js";
import { MastraStudioMiddleware } from "./mastra-studio.middleware.js";

const MASTRA_ROUTER_BINDING = Symbol("MASTRA_ROUTER_BINDING");

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
  const mastraConfig: MastraModuleOptions = { ...options };
  delete mastraConfig.api;
  delete mastraConfig.studio;

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
 * Registers Mastra Studio and API body-parsing middlewares according to resolved options.
 * @param consumer - NestJS middleware consumer
 * @param options - Resolved Mastra module options
 * @param mountApiController - Whether `MastraController` is registered on the module
 */
function configureMastraMiddlewares(
  consumer: MiddlewareConsumer,
  options: MastraModuleOptions,
  mountApiController: boolean,
): void {
  const { enabled: apiEnabled, serverOptions } = normalizeMastraApiOptions(
    options.api,
  );
  const studioOptions = normalizeMastraStudioOptions(
    options.studio,
    apiEnabled,
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

  if (mountApiController && apiEnabled) {
    consumer
      .apply(BodyLimitMiddleware, JsonBodyMiddleware)
      .forRoutes(MastraController);
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
      ...normalizeMastraApiOptions(options.api).serverOptions,
      mastra,
    }),
  },
  MastraService,
  RouteHandlerService,
  RequestContextService,
  ShutdownService,
  AuthService,
  CustomRouteService,
  BodyLimitMiddleware,
  JsonBodyMiddleware,
  MastraAuthGuard,
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
  AuthService,
];

/**
 * Headless Mastra module used when `api` routes are explicitly disabled, keeping
 * `Mastra`, `MastraManager` auto-discovery, and optional Studio middleware active
 * without registering `MastraController`.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: MASTRA_SHARED_PROVIDERS,
  exports: MASTRA_SHARED_EXPORTS,
})
class MastraHeadlessModule implements NestModule {
  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    private readonly options: MastraModuleOptions,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    configureMastraMiddlewares(consumer, this.options, false);
  }
}

export type MastraModuleAsyncOptions = typeof ASYNC_OPTIONS_TYPE & {
  /**
   * Set to `false` to skip registering `MastraController` statically when using
   * `forRootAsync`.
   */
  api?: boolean;
};

/**
 * Global NestJS-native Mastra module.
 *
 * Reuses `@mastra/nestjs` services, interceptors, and filters with a local
 * `MastraController` mounted at `api.prefix` (defaulting to `/api/mastra`),
 * serves bundled Mastra Studio via middleware at `${prefix}/studio`, shares a
 * single `Mastra` instance, and automatically discovers all singleton
 * `BaseAgent` (and Mastra `Agent`) and `BaseWorkflow` (and Mastra `Workflow`)
 * providers.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [MastraController],
  providers: [
    ...MASTRA_SHARED_PROVIDERS,
    {
      provide: MASTRA_ROUTER_BINDING,
      inject: [ModulesContainer, MASTRA_MODULE_OPTIONS],
      useFactory: (
        modulesContainer: ModulesContainer,
        options: MastraModuleOptions,
      ) => {
        const { enabled, serverOptions } = normalizeMastraApiOptions(
          options.api,
        );
        if (!enabled) {
          return null;
        }
        return new RouterModule(modulesContainer, [
          {
            path: serverOptions.prefix,
            module: MastraModule,
          },
        ]);
      },
    },
  ],
  exports: MASTRA_SHARED_EXPORTS,
})
export class MastraModule
  extends ConfigurableModuleClass
  implements NestModule
{
  constructor(
    @Inject(MASTRA_MODULE_OPTIONS)
    private readonly options: MastraModuleOptions,
  ) {
    super();
  }

  /**
   * Configures `MastraModule` synchronously. Skips registering `MastraController`
   * when `options.api` is disabled (`false` or `{ enabled: false }`).
   * @param options - Synchronous Mastra module options
   * @returns Configured dynamic module
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const dynamicModule = super.forRoot(options);
    if (!normalizeMastraApiOptions(options.api).enabled) {
      return {
        ...dynamicModule,
        module: MastraHeadlessModule,
      };
    }
    return dynamicModule;
  }

  /**
   * Configures `MastraModule` asynchronously. Pass `api: false` on the async
   * options object to skip registering `MastraController` statically, or return
   * `{ api: false }` from the factory to disable API handling at runtime.
   * @param options - Asynchronous Mastra module options
   * @returns Configured dynamic module
   */
  static override forRootAsync(
    options: MastraModuleAsyncOptions,
  ): DynamicModule {
    const { api, ...asyncOptions } = options;
    const dynamicModule = super.forRootAsync(asyncOptions);
    if (api === false) {
      return {
        ...dynamicModule,
        module: MastraHeadlessModule,
      };
    }
    return dynamicModule;
  }

  /**
   * Mounts Mastra Studio middleware at `${prefix}/studio` and Mastra JSON/body-limit
   * middleware scoped to `MastraController`.
   * @param consumer - NestJS middleware consumer
   */
  configure(consumer: MiddlewareConsumer): void {
    configureMastraMiddlewares(consumer, this.options, true);
  }
}
