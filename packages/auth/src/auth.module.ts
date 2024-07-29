import {
  REQUEST,
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Inject, Module, OnModuleInit, Type } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Request } from "express";

import { AUTH_PERSONAL_ACCESS_TOKEN, AUTH_USER } from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { PersonalAccessToken, User } from "./entities";
import { AuthModuleOptions } from "./interfaces";

@Module({
  imports: [RequestContextModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthService,
    Reflector,
  ],
  exports: [AuthService],
})
export class AuthModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(
    private readonly authService: AuthService,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    super();

    this.defaultRequireAuth = this.options?.defaultRequireAuth ?? true;

    this.userEntityClass = this.options.entities?.User ?? User;
    this.personalAccessTokenEntityClass =
      this.options.entities?.PersonalAccessToken ?? PersonalAccessToken;
  }

  onModuleInit() {
    RequestContext.registerMiddleware(async (ctx, next) => {
      if (ctx.type === "http") {
        const req = ctx.get<Request>(REQUEST);

        if (req) {
          const token = this.extractPersonalAccessToken(req);

          if (token) {
            const personalAccessToken = await this.authService.getToken(token);
            const user = await personalAccessToken?.user.load();

            if (personalAccessToken && user) {
              RequestContext.set(this.userEntityClass as Type<User>, user);
              RequestContext.set(
                this
                  .personalAccessTokenEntityClass as Type<PersonalAccessToken>,
                personalAccessToken,
              );

              RequestContext.set(AUTH_USER, user);
              RequestContext.set(
                AUTH_PERSONAL_ACCESS_TOKEN,
                personalAccessToken,
              );

              await this.authService.updateLastUsedAt(personalAccessToken);
            }
          }
        }
      }

      return await next();
    });
  }

  /**
   * Extracts the personal access token from the request.
   * @param req - The request object.
   * @returns The personal access token, or null if it doesn't exist.
   */
  private extractPersonalAccessToken(req: Request): string | null {
    const authorizationHeader = req.get("authorization");
    if (typeof authorizationHeader !== "undefined") {
      const matched = authorizationHeader.match(/(\S+)\s+(\S+)/);

      if (matched !== null && matched[1].toLowerCase() === "bearer") {
        return matched[2];
      }
    }

    if (typeof req.cookies?.token === "string") {
      return req.cookies.token;
    }

    return null;
  }
}
