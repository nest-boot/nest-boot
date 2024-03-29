import { EntityManager, MikroORM } from "@mikro-orm/core";
import {
  type EntityName,
  MikroOrmModule,
  type MikroOrmModuleFeatureOptions,
} from "@mikro-orm/nestjs";
import { HealthCheckRegistry } from "@nest-boot/health-check";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Logger,
  Module,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";

import { DatabaseHealthIndicator } from "./database.health-indicator";
import { DatabaseLogger } from "./database.logger";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./database.module-definition";
import { type DatabaseModuleOptions } from "./interfaces";
import { withBaseConfig } from "./utils/with-base-config.util";

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [DatabaseHealthIndicator],
})
export class DatabaseModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.withMikroOrm(super.forRoot(options));
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.withMikroOrm(super.forRootAsync(options));
  }

  static forFeature(
    options: MikroOrmModuleFeatureOptions | EntityName<Partial<any>>[],
    contextName?: string,
  ): DynamicModule {
    return MikroOrmModule.forFeature(options, contextName);
  }

  constructor(
    private readonly orm: MikroORM,
    private readonly healthIndicator: DatabaseHealthIndicator,
    @Optional()
    private readonly healthCheckRegistry?: HealthCheckRegistry,
  ) {
    super();
  }

  private static withMikroOrm(dynamicModule: DynamicModule): DynamicModule {
    const MikroOrmDynamicModule = MikroOrmModule.forRootAsync({
      providers: [Logger],
      inject: [MODULE_OPTIONS_TOKEN, Logger],
      useFactory: (options: DatabaseModuleOptions, logger: Logger) => {
        return {
          ...withBaseConfig(options),
          autoLoadEntities: false,
          registerRequestContext: false,
          context: () => {
            if (RequestContext.isActive()) {
              return RequestContext.get(EntityManager);
            }
          },
          loggerFactory:
            options.debug === true
              ? (options) => new DatabaseLogger(options, logger)
              : undefined,
        };
      },
    });

    return {
      global: true,
      ...dynamicModule,
      imports: [...(dynamicModule.imports ?? []), MikroOrmDynamicModule],
      exports: [MODULE_OPTIONS_TOKEN],
    };
  }

  onModuleInit(): void {
    if (typeof this.healthCheckRegistry !== "undefined") {
      this.healthCheckRegistry.register(
        async () => await this.healthIndicator.pingCheck("database"),
      );
    }

    RequestContext.registerMiddleware(async (ctx, next) => {
      ctx.set(EntityManager, this.orm.em.fork({ useContext: true }));
      return await next();
    });
  }
}
