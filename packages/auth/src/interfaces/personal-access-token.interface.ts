export interface PersonalAccessTokenInterface {
  // ID
  id: string;

  // 名称
  name: string;

  // 令牌
  token: string;

  // 实体 ID
  entityId: string;

  // 实体名称
  entityName: string;

  // 最后使用时间
  lastUsedAt?: Date;

  // 过期时间
  expiresAt?: Date;
}
