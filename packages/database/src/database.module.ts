import {
  EntityName,
  MikroOrmMiddleware,
  MikroOrmModule,
  MikroOrmModuleFeatureOptions,
} from "@mikro-orm/nestjs";
import {
  DynamicModule,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";

import { DatabaseLogger } from "./database.logger";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./database.module-definition";
import { DatabaseModuleOptions } from "./interfaces";
import { withBaseConfig } from "./utils/with-base-config.util";

@Module({})
export class DatabaseModule
  extends ConfigurableModuleClass
  implements NestModule
{
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.withMikroOrm(super.forRoot(options));
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.withMikroOrm(super.forRootAsync(options));
  }

  static forFeature(
    options: Array<EntityName<Partial<any>>> | MikroOrmModuleFeatureOptions,
    contextName?: string
  ): DynamicModule {
    return MikroOrmModule.forFeature(options, contextName);
  }

  private static withMikroOrm(dynamicModule: DynamicModule): DynamicModule {
    const MikroOrmDynamicModule = MikroOrmModule.forRootAsync({
      providers: [Logger],
      inject: [MODULE_OPTIONS_TOKEN, Logger],
      useFactory: async (options: DatabaseModuleOptions, logger: Logger) => {
        process.env.NO_COLOR = "true";

        return {
          ...withBaseConfig(options),
          autoLoadEntities: false,
          registerRequestContext: false,
          loggerFactory: (options) => new DatabaseLogger(options, logger),
        };
      },
    });

    return {
      ...dynamicModule,
      imports: [...(dynamicModule.imports ?? []), MikroOrmDynamicModule],
      exports: [MODULE_OPTIONS_TOKEN],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MikroOrmMiddleware).forRoutes("*");
  }
}
