import { EntityManager, Reference } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { CanActivate, ExecutionContext, Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import _ from "lodash";

import { AUTH_ACCESS_TOKEN, AUTH_ENTITY } from "./auth.constants";
import {
  MODULE_OPTIONS_TOKEN,
  PERMISSIONS_METADATA_KEY,
  REQUIRE_AUTH_METADATA_KEY,
} from "./auth.module-definition";
import {
  AccessTokenInterface,
  AuthModuleOptions,
  HasPermissions,
} from "./interfaces";

export class AuthGuard implements CanActivate {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly reflector: Reflector,
    private readonly entityManager: EntityManager
  ) {
    this.reflector = reflector;
  }

  public async canActivate(
    executionContext: ExecutionContext
  ): Promise<boolean> {
    if (!["http", "graphql"].includes(executionContext.getType())) {
      return true;
    }

    // 获取方法是否需要认证
    const requireAuth = this.reflector.get<boolean>(
      REQUIRE_AUTH_METADATA_KEY,
      executionContext.getHandler()
    );

    // 如果默认公开或有公共访问权限直接放行
    if (!(requireAuth ?? this.options.defaultRequireAuth ?? false)) {
      return true;
    }

    const accessToken =
      RequestContext.get<AccessTokenInterface>(AUTH_ACCESS_TOKEN);

    // 如果上下文中没有认证信息拒绝访问
    if (typeof accessToken === "undefined") {
      return false;
    }

    // 获取方法权限
    const permissions = this.reflector.get<string[]>(
      PERMISSIONS_METADATA_KEY,
      executionContext.getHandler()
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

    return false;
  }

  async getPermissions(): Promise<string[]> {
    let permissions: string[] = [];

    const entity = RequestContext.get<Partial<HasPermissions>>(AUTH_ENTITY);

    if (typeof entity !== "undefined") {
      if (typeof entity.permissions !== "undefined") {
        permissions = permissions.concat(entity.permissions);
      } else {
        const newPermissions = await Reference.create(entity).load(
          "permissions"
        );

        if (typeof newPermissions !== "undefined") {
          permissions = permissions.concat(newPermissions);
        }
      }
    }

    return permissions;
  }
}
