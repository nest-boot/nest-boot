import { MikroORM } from "@mikro-orm/core";
import { RequestContextModule } from "@nest-boot/request-context";
import {
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";
import { Auth, betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";

import { mikroOrmAdapter } from "./adapters/mikro-orm-adapter";
import { AUTH_TOKEN } from "./auth.constants";
import { AuthMiddleware } from "./auth.middleware";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./auth-module-options.interface";

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    AuthService,
    AuthMiddleware,
    {
      provide: AUTH_TOKEN,
      inject: [MODULE_OPTIONS_TOKEN, MikroORM],
      useFactory: (options: AuthModuleOptions, orm: MikroORM) =>
        betterAuth({
          baseURL: process.env.AUTH_URL ?? process.env.APP_URL,
          secret: process.env.AUTH_SECRET ?? process.env.APP_SECRET,
          ...options,
          database: mikroOrmAdapter({
            orm,
            entities: options.entities,
          }),
        }),
    },
  ],
  exports: [AuthService, AuthMiddleware],
})
export class AuthModule extends ConfigurableModuleClass implements NestModule {
  constructor(
    @Inject(AUTH_TOKEN)
    private readonly auth: Auth,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(toNodeHandler(this.auth))
      .forRoutes(this.options.basePath ?? "/api/auth/{*any}");

    if (this.options.middleware?.register !== false) {
      const proxy = consumer.apply(AuthMiddleware);

      if (this.options.middleware?.excludeRoutes) {
        proxy.exclude(...this.options.middleware.excludeRoutes);
      }

      if (this.options.middleware?.includeRoutes) {
        proxy.forRoutes(...this.options.middleware.includeRoutes);
      } else {
        proxy.forRoutes("*");
      }
    }
  }
}
