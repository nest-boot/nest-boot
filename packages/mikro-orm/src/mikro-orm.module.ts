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

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mikro-orm.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

/**
 * MikroORM integration module with request-scoped entity manager.
 *
 * @remarks
 * Wraps `@mikro-orm/nestjs` with automatic environment-based configuration
 * and request context integration for per-request entity manager forking.
 */
@Global()
@Module({
  imports: [
    RequestContextModule,
    BaseMikroOrmModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (options: MikroOrmModuleOptions) => {
        const logger = new Logger("MikroORM");

        return {
          registerRequestContext: false,
          context: () => {
            if (RequestContext.isActive()) {
              return RequestContext.get(EntityManager);
            }
          },
          logger: (msg) => {
            logger.log(msg);
          },
          ...(await loadConfigFromEnv()),
          ...options,
        };
      },
    }),
  ],
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
    return super.forRoot(options);
  }

  /**
   * Registers the MikroOrmModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
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
