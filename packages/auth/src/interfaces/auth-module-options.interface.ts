import { type EntityClass } from "@mikro-orm/core";
import { type RouteInfo, type Type } from "@nestjs/common/interfaces";

import { type AccessTokenInterface } from "./access-token.interface";

/**
 * 认证模块选项
 */
export interface AuthModuleOptions {
  // 个人访问令牌实体
  accessTokenEntityClass: EntityClass<AccessTokenInterface>;

  // 令牌过期时间，单位毫秒，支持 ms 格式如：1d
  expiresIn?: string | number;

  // 默认是否要求认证
  defaultRequireAuth?: boolean;

  // 包含路由默认为 *
  includeRoutes?: (string | Type | RouteInfo)[];

  // 排除路由默认为空
  excludeRoutes?: (string | RouteInfo)[];
}
