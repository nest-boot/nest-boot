import { EntityManager, MikroORM } from "@mikro-orm/core";
import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Global, Logger, Module, OnModuleInit } from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./mikro-orm.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

/**
 * Module that integrates MikroORM with NestJS.
 * It uses the @nest-boot/request-context module to manage the EntityManager context.
 * It also automatically loads configuration from environment variables.
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
  constructor(private readonly orm: MikroORM) {
    super();
  }

  /**
   * Register entities for a feature module.
   *
   * @param args - Arguments for forFeature.
   * @returns Dynamic module.
   */
  static forFeature(...args: Parameters<typeof BaseMikroOrmModule.forFeature>) {
    return BaseMikroOrmModule.forFeature(...args);
  }

  /**
   * Register middleware for MikroORM.
   *
   * @param args - Arguments for forMiddleware.
   * @returns Middleware configuration.
   */
  static forMiddleware(
    ...args: Parameters<typeof BaseMikroOrmModule.forMiddleware>
  ) {
    return BaseMikroOrmModule.forMiddleware(...args);
  }

  /**
   * Clears the storage.
   *
   * @param args - Arguments for clearStorage.
   */
  static clearStorage(
    ...args: Parameters<typeof BaseMikroOrmModule.clearStorage>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return BaseMikroOrmModule.clearStorage(...args);
  }

  /**
   * Registers a middleware in the RequestContext to fork the EntityManager for each request.
   */
  onModuleInit(): void {
    RequestContext.registerMiddleware("mikro-orm", (ctx, next) => {
      ctx.set(EntityManager, this.orm.em.fork({ useContext: true }));
      return next();
    });
  }
}
