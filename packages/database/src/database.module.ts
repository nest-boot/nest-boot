import { ConfigurationLoader } from "@mikro-orm/core";
import {
  EntityName,
  MikroOrmMiddleware,
  MikroOrmModule,
  MikroOrmModuleFeatureOptions,
  MikroOrmModuleOptions,
} from "@mikro-orm/nestjs";
import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";

import { DatabaseLogger } from "./database.logger";
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./database.module-definition";

@Module({})
export class DatabaseModule
  extends ConfigurableModuleClass
  implements NestModule
{
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const dynamicModule = super.forRoot(options);
    return {
      ...dynamicModule,
      imports: [
        ...(typeof dynamicModule.imports !== "undefined"
          ? dynamicModule.imports
          : []),
        MikroOrmModule.forRootAsync({
          useFactory: async () => {
            const config = await ConfigurationLoader.getConfiguration();

            process.env.NO_COLOR = "true";

            config.set(
              "loggerFactory",
              (options) => new DatabaseLogger(options)
            );

            const options: MikroOrmModuleOptions =
              config as unknown as MikroOrmModuleOptions;
            options.autoLoadEntities = false;
            options.registerRequestContext = false;

            return options;
          },
        }),
      ],
    };
  }

  static forFeature(
    options: Array<EntityName<Partial<any>>> | MikroOrmModuleFeatureOptions,
    contextName?: string
  ): DynamicModule {
    return MikroOrmModule.forFeature(options, contextName);
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MikroOrmMiddleware).forRoutes("*");
  }
}
