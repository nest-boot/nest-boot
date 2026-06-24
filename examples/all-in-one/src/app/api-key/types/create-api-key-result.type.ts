import { Field, ObjectType } from '@nest-boot/graphql';

import { ApiKey } from '../api-key.entity.js';

/**
 * 创建 API Key 后返回给客户端的结果。
 */
@ObjectType()
export class CreateApiKeyResult {
  /** 创建成功后的 API Key 实体。 */
  @Field(() => ApiKey)
  entity!: ApiKey;

  /** 仅在创建时返回一次的 API Key 明文。 */
  @Field(() => String)
  apiKey!: string;
}
