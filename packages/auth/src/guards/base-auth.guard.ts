import { Context, PERMISSIONS_METADATA_KEY } from "@nest-boot/common";
import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import _ from "lodash";

export abstract class BaseAuthGuard implements CanActivate {
  protected abstract readonly reflector: Reflector;

  public async canActivate(
    executionContext: ExecutionContext
  ): Promise<boolean> {
    // 获取运行上下文
    const ctx = Context.get();

    // 获取配置权限
    const permissions = this.reflector.get<string[]>(
      PERMISSIONS_METADATA_KEY,
      executionContext.getHandler()
    );

    // 如果有公共权限直接放行
    if (permissions?.includes("PUBLIC")) {
      return true;
    }

    // 没有配置权限须登录才能访问
    if (typeof permissions === "undefined" && ctx?.user != null) {
      return true;
    }

    // 判断用户权限和配置权限是否有交集，如果有放行
    return _.intersection(await this.getPermissions(), permissions).length > 0;
  }

  protected abstract getPermissions(): Promise<string[]>;
}
