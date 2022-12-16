import { EntityManager, Reference } from "@mikro-orm/core";
import { Context } from "@nest-boot/common";
import { CanActivate, ExecutionContext, Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import _ from "lodash";

import {
  MODULE_OPTIONS_TOKEN,
  PERMISSIONS_METADATA_KEY,
  REQUIRE_AUTH_METADATA_KEY,
} from "./auth.module-definition";
import { AuthModuleOptions, AuthPayload, HasPermissions } from "./interfaces";

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
    if (executionContext.getType() !== "http") {
      return true;
    }

    // 获取运行上下文
    const ctx = Context.get();

    // 获取方法是否需要认证
    const requireAuth = this.reflector.get<boolean>(
      REQUIRE_AUTH_METADATA_KEY,
      executionContext.getHandler()
    );

    // 如果默认公开或有公共访问权限直接放行
    if (!(requireAuth ?? this.options.defaultRequireAuth ?? false)) {
      return true;
    }

    const authPayload = ctx.get<AuthPayload>("auth");

    // 如果上下文中没有认证信息拒绝访问
    if (typeof authPayload === "undefined") {
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
      _.intersection(await this.getPermissions(ctx), permissions).length > 0
    ) {
      authPayload.personalAccessToken.lastUsedAt = new Date();
      await this.entityManager.flush();

      return true;
    }

    return false;
  }

  async getPermissions(ctx: Context): Promise<string[]> {
    let permissions: string[] = [];

    const payload = ctx.get<AuthPayload<Partial<HasPermissions>>>("auth");

    if (typeof payload !== "undefined") {
      if (typeof payload.entity.permissions !== "undefined") {
        permissions = permissions.concat(payload.entity.permissions);
      } else {
        const newPermissions = await Reference.create(payload.entity).load(
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
