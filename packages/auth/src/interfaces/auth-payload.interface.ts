import { AnyEntity } from "@mikro-orm/core";

import { PersonalAccessTokenInterface } from "./personal-access-token.interface";

/**
 * 认证荷载
 */
export interface AuthPayload<T extends AnyEntity = AnyEntity> {
  // 实体
  entity: T;

  // 个人访问令牌
  personalAccessToken: PersonalAccessTokenInterface;
}
