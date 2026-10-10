import { EntityManager, MikroORM } from "@mikro-orm/core";
import { MikroOrmModule as BaseDatabaseModule } from "@mikro-orm/nestjs";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Inject,
  Logger,
  Module,
  OnModuleInit,
} from "@nestjs/common";

import { DatabaseHealthIndicator } from "./database.health-indicator.js";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./database.module-definition.js";
import type { DatabaseModuleOptions } from "./interfaces/database-module-options.interface.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";
import { loadDefaultConfig } from "./utils/load-default-config.util.js";

const CONNECTION_TARGET_OPTION_KEYS = [
  "dbName",
  "clientUrl",
  "host",
  "port",
  "user",
  "password",
  "replicas",
] as const satisfies readonly (keyof DatabaseModuleOptions)[];

@Module({})
class DatabaseOptionsHostModule {}

/**
 * Returns whether the module options specify a connection target.
 * @param options - Configuration for this operation.
 * @returns Whether the module options specify a connection target.
 */
function hasExplicitConnectionTarget(options: DatabaseModuleOptions): boolean {
  return CONNECTION_TARGET_OPTION_KEYS.some(
    (key) => options[key] !== undefined,
  );
}

/**
 * MikroORM integration module with request-scoped entity manager.
 *
 * Wraps `@mikro-orm/nestjs` with automatic environment-based configuration
 * and request context integration for per-request entity manager forking.
 * Automatic `DATABASE_URL` loading is skipped when an explicit URL or
 * host-style connection target is registered, so ambient connection fields
 * cannot be merged into it.
 * Importing `HealthCheckModule` also registers the existing database connection
 * under the `database` health check key using `DatabaseHealthIndicator`.
 */
@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    DatabaseHealthIndicator,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: DatabaseModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN, DatabaseHealthIndicator],
})
export class DatabaseModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  /**
   * Registers the DatabaseModule with the given options.
   * @param options - MikroORM configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const optionsModule = this.createOptionsModule(super.forRoot(options));

    return {
      module: DatabaseModule,
      imports: [
        optionsModule,
        this.createRootModule(optionsModule, options.driver),
      ],
    };
  }

  /**
   * Registers the DatabaseModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    const optionsModule = this.createOptionsModule(super.forRootAsync(options));

    return {
      module: DatabaseModule,
      imports: [
        optionsModule,
        this.createRootModule(optionsModule, options.driverHint),
      ],
    };
  }

  private static createOptionsModule(
    configurableModule: DynamicModule,
  ): DynamicModule {
    return {
      module: DatabaseOptionsHostModule,
      imports: configurableModule.imports,
      providers: configurableModule.providers,
      exports: [BASE_MODULE_OPTIONS_TOKEN],
    };
  }

  private static createRootModule(
    optionsModule: DynamicModule,
    driver?: DatabaseModuleOptions["driver"],
  ) {
    return BaseDatabaseModule.forRootAsync({
      driver,
      imports: [optionsModule],
      inject: [BASE_MODULE_OPTIONS_TOKEN],
      useFactory: async (options: DatabaseModuleOptions) => {
        const ormOptions = { ...options };
        delete ormOptions.session;
        const logger = new Logger("Database");
        const envOptions = hasExplicitConnectionTarget(options)
          ? loadDefaultConfig()
          : await loadConfigFromEnv();

        const resolvedOptions = {
          registerRequestContext: false,
          context: () => {
            if (RequestContext.isActive()) {
              return RequestContext.get(EntityManager);
            }
          },
          logger: (msg: string) => {
            logger.log(msg);
          },
          ...envOptions,
          ...ormOptions,
          metadataCache: {
            ...envOptions.metadataCache,
            ...ormOptions.metadataCache,
            enabled:
              ormOptions.metadataCache?.enabled ??
              envOptions.metadataCache?.enabled ??
              false,
          },
        };

        if (
          options.entities !== undefined &&
          options.entitiesTs === undefined
        ) {
          resolvedOptions.entitiesTs = options.entities;
        }

        return resolvedOptions;
      },
    });
  }

  /**
   * Creates a new DatabaseModule instance.
   * @param orm - The MikroORM instance
   * @param options - Nest Boot configuration, including the session factory
   */
  constructor(
    private readonly orm: MikroORM,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: DatabaseModuleOptions = {},
  ) {
    super();
  }

  /**
   * Registers entity classes for use in the given module scope.
   * @param args - forFeature arguments (entity classes, options)
   * @returns Dynamic module configuration
   */
  static forFeature(...args: Parameters<typeof BaseDatabaseModule.forFeature>) {
    return BaseDatabaseModule.forFeature(...args);
  }

  /**
   * Registers MikroORM middleware for the module.
   * @param args - forMiddleware arguments
   * @returns Dynamic module configuration
   */
  static forMiddleware(
    ...args: Parameters<typeof BaseDatabaseModule.forMiddleware>
  ) {
    return BaseDatabaseModule.forMiddleware(...args);
  }

  /**
   * Clears the MikroORM metadata storage.
   * @param args - clearStorage arguments
   * @returns Result of clearing the base module's registration storage.
   */
  static clearStorage(
    ...args: Parameters<typeof BaseDatabaseModule.clearStorage>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return BaseDatabaseModule.clearStorage(...args);
  }

  /** Registers the MikroORM entity manager fork middleware in the request context. */
  onModuleInit(): void {
    RequestContext.registerMiddleware("database", (ctx, next) => {
      ctx.set(
        EntityManager,
        this.orm.em.fork({
          useContext: true,
          ...(this.options.session ? { session: this.options.session() } : {}),
        }),
      );
      return next();
    });
  }
}
