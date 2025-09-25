import { DataloaderType, EntityManager, MikroORM } from "@mikro-orm/core";
import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { DynamicModule, OnModuleInit } from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mikro-orm.module-definition";

export class MikroOrmModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(private readonly orm: MikroORM) {
    super();
  }

  static #patchDynamicModule(
    options: Pick<MikroOrmModuleOptions, "driver">,
    dynamicModule: DynamicModule,
  ) {
    dynamicModule.global = true;

    dynamicModule.imports = [
      RequestContextModule,
      BaseMikroOrmModule.forRootAsync({
        driver: options.driver,
        inject: [MODULE_OPTIONS_TOKEN],
        useFactory: (options: MikroOrmModuleOptions) => {
          return {
            dataloader: DataloaderType.ALL,
            registerRequestContext: false,
            ...options,
          };
        },
      }),
    ];

    dynamicModule.exports = dynamicModule.providers;

    return dynamicModule;
  }

  static forRoot(options: typeof OPTIONS_TYPE) {
    return this.#patchDynamicModule(options, super.forRoot(options));
  }

  static forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE & Pick<MikroOrmModuleOptions, "driver">,
  ) {
    return this.#patchDynamicModule(options, super.forRootAsync(options));
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
    RequestContext.registerMiddleware(
      "database",
      (ctx, next) => {
        ctx.set(EntityManager, this.orm.em.fork({ useContext: true }));
        return next();
      },
      ["logger"],
    );
  }
}
