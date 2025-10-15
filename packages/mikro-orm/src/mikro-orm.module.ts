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
import { Global, Module, OnModuleInit } from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./mikro-orm.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

@Global()
@Module({
  imports: [
    RequestContextModule,
    BaseMikroOrmModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (options: MikroOrmModuleOptions) => ({
        registerRequestContext: false,
        ...(await loadConfigFromEnv()),
        ...options,
      }),
    }),
  ],
  providers: [
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: MikroOrmModuleOptions = {}) => options,
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
