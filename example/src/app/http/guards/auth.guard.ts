import { BaseAuthGuard } from "@nest-boot/auth";
import { Context } from "@nest-boot/common";
import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class AuthGuard extends BaseAuthGuard {
  constructor(protected readonly reflector: Reflector) {
    super();
  }

  // 需要自定义获取用户权限的方法
  async getPermissions(): Promise<string[]> {
    return Context.get()?.user?.permissions || [];
  }
}
