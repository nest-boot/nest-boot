import { I18N, type I18n } from "@nest-boot/i18n";
import { RequestContext } from "@nest-boot/request-context";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import _ from "lodash";

import {
  AUTH_PERSONAL_ACCESS_TOKEN,
  AUTH_USER,
  PERMISSIONS_METADATA_KEY,
  REQUIRE_AUTH_METADATA_KEY,
} from "./auth.constants";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { PersonalAccessToken, User } from "./entities";
import { AuthModuleOptions } from "./interfaces";

/**
 * Authentication guard class used to protect routes and handle requests.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly defaultRequireAuth: boolean;

  constructor(
    private readonly reflector: Reflector,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    this.defaultRequireAuth = this.options?.defaultRequireAuth ?? true;
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
   * Determines whether the request is allowed to be executed.
   * @param executionContext - The execution context object.
   * @returns True if the request is allowed to be executed, otherwise false.
   */
  public canActivate(executionContext: ExecutionContext) {
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

    const user = RequestContext.get<User>(AUTH_USER);
    const personalAccessToken = RequestContext.get<PersonalAccessToken>(
      AUTH_PERSONAL_ACCESS_TOKEN,
    );

    if (personalAccessToken === null || user == null) {
      throw new UnauthorizedException(
        this.t("The personal access token is invalid."),
      );
    }

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
