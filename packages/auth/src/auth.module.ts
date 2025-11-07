import { MikroORM } from "@mikro-orm/core";
import {
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
  Provider,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Auth, betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { Express } from "express";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter";
import { AUTH_TOKEN } from "./auth.constants";
import { AuthMiddleware } from "./auth.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./auth-module-options.interface";

const authProvider: Provider = {
  provide: AUTH_TOKEN,
  inject: [MODULE_OPTIONS_TOKEN, MikroORM],
  useFactory: (options: AuthModuleOptions, orm: MikroORM) =>
    betterAuth({
      ...options,
      database: mikroOrmAdapter({
        orm,
        entities: options.entities,
      }),
    }),
};

@Module({
  providers: [authProvider, AuthService],
  exports: [AuthService],
})
export class AuthModule
  extends ConfigurableModuleClass
  implements NestModule, OnModuleInit
{
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(AUTH_TOKEN)
    private readonly auth: Auth,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    const proxy = consumer.apply(AuthMiddleware);

    if (this.options.middleware?.excludeRoutes) {
      proxy.exclude(...this.options.middleware.excludeRoutes);
    }

    proxy.forRoutes(...(this.options.middleware?.includeRoutes ?? ["*"]));
  }

  onModuleInit() {
    const app = this.adapterHost.httpAdapter.getInstance<Express>();

    app.all(
      this.options.basePath ?? "/api/auth/{*any}",
      toNodeHandler(this.auth),
    );
  }
}
