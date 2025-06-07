import { EntityClass, EntityManager } from "@mikro-orm/core";
import { I18N, type I18n } from "@nest-boot/i18n";
import { RequestContext } from "@nest-boot/request-context";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  Type,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import DataLoader from "dataloader";
import { Request } from "express";
import _ from "lodash";

import {
  AUTH_PERSONAL_ACCESS_TOKEN,
  AUTH_USER,
  PERMISSIONS_METADATA_KEY,
  REQUIRE_AUTH_METADATA_KEY,
} from "./auth.constants";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { PersonalAccessToken, User } from "./entities";
import { AuthModuleOptions } from "./interfaces";

/**
 * Authentication guard class used to protect routes and handle requests.
 */
@Injectable({ scope: Scope.REQUEST })
export class AuthGuard implements CanActivate {
  private readonly defaultRequireAuth: boolean;

  private readonly userEntityClass: EntityClass<User>;
  private readonly personalAccessTokenEntityClass: EntityClass<PersonalAccessToken>;

  private readonly personalAccessTokenAndUserDataLoader: DataLoader<
    string,
    { personalAccessToken: PersonalAccessToken; user: User }
  >;

  constructor(
    private readonly reflector: Reflector,
    private readonly em: EntityManager,
    private readonly authService: AuthService,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    this.reflector = reflector;
    this.defaultRequireAuth = this.options?.defaultRequireAuth ?? true;

    this.userEntityClass = this.options.entities?.User ?? User;
    this.personalAccessTokenEntityClass =
      this.options.entities?.PersonalAccessToken ?? PersonalAccessToken;

    this.personalAccessTokenAndUserDataLoader = new DataLoader((tokens) =>
      Promise.all(
        tokens.map((token) => this.getPersonalAccessTokenAndUser(token)),
      ),
    );
  }

  /**
   * Get internationalized text based on the specified key.
   * @param key - The key of the internationalized text.
   * @returns The internationalized text.
   */
  private t(key: string): string {
    return RequestContext.get<I18n>(I18N)?.t(key, { ns: "auth" }) ?? key;
  }

  /**
   * Extracts the personal access token from the request.
   * @param req - The request object.
   * @returns The personal access token, or null if it doesn't exist.
   */
  private extractPersonalAccessToken(req: Request): string | null {
    const authorizationHeader = req.get("authorization");
    if (typeof authorizationHeader !== "undefined") {
      const matched = /(\S+)\s+(\S+)/.exec(authorizationHeader);

      if (matched !== null && matched[1].toLowerCase() === "bearer") {
        return matched[2];
      }
    }

    if (typeof req.cookies?.token === "string") {
      return req.cookies.token;
    }

    return null;
  }

  private async getPersonalAccessTokenAndUser(
    token: string,
  ): Promise<{ personalAccessToken: PersonalAccessToken; user: User }> {
    const personalAccessToken = await this.authService.getToken(token);
    const user = await personalAccessToken?.user.load();

    if (personalAccessToken === null || user == null) {
      throw new UnauthorizedException(
        this.t("The personal access token is invalid."),
      );
    }

    await this.authService.updateLastUsedAt(personalAccessToken);

    RequestContext.set(this.userEntityClass as Type<User>, user);
    RequestContext.set(
      this.personalAccessTokenEntityClass as Type<PersonalAccessToken>,
      personalAccessToken,
    );

    RequestContext.set(AUTH_USER, user);
    RequestContext.set(AUTH_PERSONAL_ACCESS_TOKEN, personalAccessToken);

    return { personalAccessToken, user };
  }

  /**
   * Determines whether the request is allowed to be executed.
   * @param executionContext - The execution context object.
   * @returns True if the request is allowed to be executed, otherwise false.
   */
  public async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    if (!["http", "graphql"].includes(executionContext.getType())) {
      return true;
    }

    // Get whether the method requires authentication
    const requireAuth =
      this.reflector.get<boolean>(
        REQUIRE_AUTH_METADATA_KEY,
        executionContext.getHandler(),
      ) ??
      this.reflector.get<boolean>(
        REQUIRE_AUTH_METADATA_KEY,
        executionContext.getClass(),
      );

    // If it's publicly accessible by default or has public access permission, allow access directly
    if (!(requireAuth ?? this.defaultRequireAuth ?? false)) {
      return true;
    }

    // Get the Request object
    const req =
      executionContext.switchToHttp().getRequest<Request>() ??
      executionContext.getArgs()[2].req;

    // Extract the token
    const token = this.extractPersonalAccessToken(req);

    if (token === null) {
      throw new UnauthorizedException(
        this.t("The personal access token is invalid."),
      );
    }

    const { user } =
      await this.personalAccessTokenAndUserDataLoader.load(token);

    // Get the method permissions
    const permissions = this.reflector.get<string[]>(
      PERMISSIONS_METADATA_KEY,
      executionContext.getHandler(),
    );

    // If there are no permission requirements, allow access directly
    // Check if there is an intersection between user permissions and configured permissions, if so, allow access
    if (
      typeof permissions === "undefined" ||
      _.intersection(user.permissions, permissions).length > 0
    ) {
      return true;
    }

    throw new ForbiddenException(this.t("Permission denied."));
  }
}
