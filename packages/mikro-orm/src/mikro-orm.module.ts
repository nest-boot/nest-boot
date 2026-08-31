import { EntityManager, MikroORM } from "@mikro-orm/core";
import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Logger,
  Module,
  OnModuleInit,
} from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface.js";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mikro-orm.module-definition.js";
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
] as const satisfies readonly (keyof MikroOrmModuleOptions)[];

@Module({})
class MikroOrmOptionsHostModule {}

function hasExplicitConnectionTarget(options: MikroOrmModuleOptions): boolean {
  return CONNECTION_TARGET_OPTION_KEYS.some(
    (key) => options[key] !== undefined,
  );
}

/**
 * MikroORM integration module with request-scoped entity manager.
 *
 * @remarks
 * Wraps `@mikro-orm/nestjs` with automatic environment-based configuration
 * and request context integration for per-request entity manager forking.
 * Automatic `DATABASE_URL` loading is skipped when an explicit URL or
 * host-style connection target is registered, so ambient connection fields
 * cannot be merged into it.
 */
@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: MikroOrmModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class MikroOrmModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  /**
   * Registers the MikroOrmModule with the given options.
   * @param options - MikroORM configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const optionsModule = this.createOptionsModule(super.forRoot(options));

    return {
      module: MikroOrmModule,
      imports: [
        optionsModule,
        this.createRootModule(optionsModule, options.driver),
      ],
    };
  }

  /**
   * Registers the MikroOrmModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    const optionsModule = this.createOptionsModule(super.forRootAsync(options));

    return {
      module: MikroOrmModule,
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
      module: MikroOrmOptionsHostModule,
      imports: configurableModule.imports,
      providers: configurableModule.providers,
      exports: [BASE_MODULE_OPTIONS_TOKEN],
    };
  }

  private static createRootModule(
    optionsModule: DynamicModule,
    driver?: MikroOrmModuleOptions["driver"],
  ) {
    return BaseMikroOrmModule.forRootAsync({
      driver,
      imports: [optionsModule],
      inject: [BASE_MODULE_OPTIONS_TOKEN],
      useFactory: async (options: MikroOrmModuleOptions) => {
        const logger = new Logger("MikroORM");
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
          ...options,
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

  /** Creates a new MikroOrmModule instance.
   * @param orm - The MikroORM instance
   */
  constructor(private readonly orm: MikroORM) {
    super();
  }

  /**
   * Registers entity classes for use in the given module scope.
   * @param args - forFeature arguments (entity classes, options)
   * @returns Dynamic module configuration
   */
  static forFeature(...args: Parameters<typeof BaseMikroOrmModule.forFeature>) {
    return BaseMikroOrmModule.forFeature(...args);
  }

  /**
   * Registers MikroORM middleware for the module.
   * @param args - forMiddleware arguments
   * @returns Dynamic module configuration
   */
  static forMiddleware(
    ...args: Parameters<typeof BaseMikroOrmModule.forMiddleware>
  ) {
    return BaseMikroOrmModule.forMiddleware(...args);
  }

  /**
   * Clears the MikroORM metadata storage.
   * @param args - clearStorage arguments
   */
  static clearStorage(
    ...args: Parameters<typeof BaseMikroOrmModule.clearStorage>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return BaseMikroOrmModule.clearStorage(...args);
  }

  /** Registers the MikroORM entity manager fork middleware in the request context. */
  onModuleInit(): void {
    RequestContext.registerMiddleware("mikro-orm", (ctx, next) => {
      ctx.set(EntityManager, this.orm.em.fork({ useContext: true }));
      return next();
    });
  }
}
