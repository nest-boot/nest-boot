import {
  EntityManager,
  MikroORM,
  RequestContext as MikroRequestContext,
} from "@mikro-orm/core";
import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { DynamicModule, Module, OnModuleInit } from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mikro-orm.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

@Module({
  imports: [RequestContextModule],
})
export class MikroOrmModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(private readonly orm: MikroORM) {
    super();
  }

  private static patchDynamicModule(
    options: Pick<MikroOrmModuleOptions, "driver">,
    dynamicModule: DynamicModule,
  ) {
    const BaseMikroOrmDynamicModule = BaseMikroOrmModule.forRootAsync({
      driver: options.driver,
      imports: [dynamicModule],
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: MikroOrmModuleOptions) => {
        return {
          registerRequestContext: false,
          ...loadConfigFromEnv(),
          ...options,
        };
      },
    });

    dynamicModule.imports = [
      ...(dynamicModule.imports ?? []),
      BaseMikroOrmDynamicModule,
    ];

    dynamicModule.exports = [MODULE_OPTIONS_TOKEN];

    return dynamicModule;
  }

  static forRoot(options: typeof OPTIONS_TYPE) {
    return this.patchDynamicModule(options, super.forRoot(options));
  }

  static forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE & Pick<MikroOrmModuleOptions, "driver">,
  ) {
    return this.patchDynamicModule(options, super.forRootAsync(options));
  }

  static forFeature(...args: Parameters<typeof BaseMikroOrmModule.forFeature>) {
    return BaseMikroOrmModule.forFeature(...args);
  }

  static forMiddleware(
    ...args: Parameters<typeof BaseMikroOrmModule.forMiddleware>
  ) {
    return BaseMikroOrmModule.forMiddleware(...args);
  }

  static clearStorage(
    ...args: Parameters<typeof BaseMikroOrmModule.clearStorage>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return BaseMikroOrmModule.clearStorage(...args);
  }

  onModuleInit(): void {
    RequestContext.registerMiddleware("mikro-orm", (ctx, next) => {
      return MikroRequestContext.create(this.orm.em, () => {
        ctx.set(EntityManager, this.orm.em);
        return next();
      });
    });
  }
}
