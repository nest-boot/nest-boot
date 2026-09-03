import type { Opt, Ref } from '@mikro-orm/core';
import { t } from '@mikro-orm/core';
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { BaseApiKey } from '@nest-boot/auth';
import { Field, HideField, ID, ObjectType } from '@nest-boot/graphql';
import { Sonyflake } from 'sonyflake-js';

import type { User } from '../user/user.entity.js';
import type { Workspace } from '../workspace/workspace.entity.js';

/**
 * 用户或工作区用于访问接口的 API Key。
 */
@ObjectType()
@Entity()
@Index({ properties: ['key'] })
@Index({ properties: ['prefix'] })
@Index({ properties: ['owner'] })
@Index({ properties: ['createdAt'] })
export class ApiKey extends BaseApiKey {
  /** API Key 唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({ type: t.bigint })
  override id: Opt<string> = Sonyflake.next().toString();

  /** API Key 显示名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare name: string;

  /** 用于在界面中识别密钥的开头字符。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.string, nullable: true })
  override start?: Opt<string> | null = null;

  /** API Key 明文前缀。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.string, nullable: true })
  override prefix?: Opt<string> | null = null;

  /** 完整 API Key 的 SHA-256 哈希。 */
  @HideField()
  @Property({ type: t.text })
  declare key: string;

  /** 是否允许此 API Key 进行身份认证。 */
  @Field(() => Boolean)
  @Property({ type: t.boolean, default: true })
  override enabled: Opt<boolean> = true;

  /** 此 API Key 可以执行的用户域与工作区域操作。 */
  @Field(() => [String])
  @Property({ type: t.array, defaultRaw: "'{}'" })
  override permissions: Opt<string[]> = [];

  /** 创建时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  override createdAt: Opt<Date> = new Date();

  /** 更新时间。 */
  @Field(() => Date)
  @Property({
    type: t.datetime,
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  override updatedAt: Opt<Date> = new Date();

  /** 最近一次成功使用时间。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  override lastUsedAt?: Opt<Date> | null = null;

  /** 过期时间，为空表示不过期。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  override expiresAt?: Opt<Date> | null = null;

  /** API Key 所属用户或工作区。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @HideField()
  declare owner: Ref<User | Workspace>;
}
