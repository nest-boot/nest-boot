import { EntityManager, Reference } from "@mikro-orm/core";
import { I18N, type I18n } from "@nest-boot/i18n";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
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

import { AUTH_ACCESS_TOKEN, AUTH_ENTITY } from "./auth.constants";
import {
  MODULE_OPTIONS_TOKEN,
  PERMISSIONS_METADATA_KEY,
  REQUIRE_AUTH_METADATA_KEY,
} from "./auth.module-definition";
import {
  type AccessTokenInterface,
  AuthModuleOptions,
  type HasPermissions,
} from "./interfaces";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly reflector: Reflector,
    private readonly entityManager: EntityManager,
  ) {
    this.reflector = reflector;
  }

  private t(key: string): string {
    return RequestContext.get<I18n>(I18N)?.t(key, { ns: "auth" }) ?? key;
  }

  public async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    if (!["http", "graphql"].includes(executionContext.getType())) {
      return true;
    }

    if (
      typeof RequestContext.get<{ authMiddlewareUsed?: boolean }>(REQUEST)
        ?.authMiddlewareUsed === "undefined"
    ) {
      return true;
    }

    // 获取方法是否需要认证
    const requireAuth =
      this.reflector.get<boolean>(
        REQUIRE_AUTH_METADATA_KEY,
        executionContext.getHandler(),
      ) ??
      this.reflector.get<boolean>(
        REQUIRE_AUTH_METADATA_KEY,
        executionContext.getClass(),
      );

    // 如果默认公开或有公共访问权限直接放行
    if (!(requireAuth ?? this.options.defaultRequireAuth ?? false)) {
      return true;
    }

    const accessToken =
      RequestContext.get<AccessTokenInterface>(AUTH_ACCESS_TOKEN);

    // 如果上下文中没有认证信息拒绝访问
    if (accessToken === null) {
      throw new UnauthorizedException(this.t("The access token is invalid."));
    }

    // 获取方法权限
    const permissions = this.reflector.get<string[]>(
      PERMISSIONS_METADATA_KEY,
      executionContext.getHandler(),
    );

    // 如果没有权限要求直接放行
    // 判断用户权限和配置权限是否有交集，如果有放行
    if (
      typeof permissions === "undefined" ||
      _.intersection(await this.getPermissions(), permissions).length > 0
    ) {
      accessToken.lastUsedAt = new Date();
      await this.entityManager.flush();

      return true;
    }

    throw new ForbiddenException(this.t("Permission denied."));
  }

  async getPermissions(): Promise<string[]> {
    let permissions: string[] = [];

    const entity = RequestContext.get<Partial<HasPermissions>>(AUTH_ENTITY);

    if (entity !== null) {
      if (typeof entity.permissions !== "undefined") {
        permissions = permissions.concat(entity.permissions);
      } else {
        const newPermissions = await Reference.create(entity).load(
          "permissions",
        );

        if (typeof newPermissions !== "undefined") {
          permissions = permissions.concat(newPermissions);
        }
      }
    }

    return permissions;
  }
}
