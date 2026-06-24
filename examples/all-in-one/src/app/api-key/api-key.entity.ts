import type { Opt, Ref } from '@mikro-orm/core';
import { t } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { Field, HideField, ID, ObjectType } from '@nest-boot/graphql';
import { Policy } from '@nest-boot/row-level-security';
import { Sonyflake } from 'sonyflake-js';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';

/**
 * 工作区成员用于访问接口的 API Key。
 */
@ObjectType()
@Policy({
  property: 'workspace',
  context: 'workspace_id',
  roles: ['authenticated'],
})
@Entity()
@Unique({ properties: ['keyId'] })
@Index({ properties: ['keyId'] })
@Index({ properties: ['keyPrefix'] })
@Index({ properties: ['workspace'] })
@Index({ properties: ['member'] })
@Index({ properties: ['createdAt'] })
export class ApiKey {
  /** API Key 唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({ type: t.bigint })
  id: Opt<string> = Sonyflake.next().toString();

  /** API Key 显示名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  name!: string;

  /** API Key 的查询标识，完整明文 key 中前缀后面的前 16 位 hex。 */
  @HideField()
  @Property({ type: t.string })
  keyId!: string;

  /** API Key 明文前缀。 */
  @Field(() => String)
  @Property({ type: t.string })
  keyPrefix!: string;

  /** API Key secret 的加密值，仅用于验证明文密钥。 */
  @HideField()
  @Property({ type: t.text })
  encryptedSecret!: string;

  /** 创建时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  /** 更新时间。 */
  @Field(() => Date)
  @Property({
    type: t.datetime,
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** 最近一次使用时间。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  lastUsedAt?: Opt<Date> | null = null;

  /** 过期时间，为空表示不过期。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  expiresAt?: Opt<Date> | null = null;

  /** API Key 所属工作区。 */
  @HideField()
  @ManyToOne(() => Workspace, { updateRule: 'cascade', deleteRule: 'cascade' })
  workspace!: Ref<Workspace>;

  /** API Key 绑定的工作区成员。 */
  @HideField()
  @ManyToOne(() => WorkspaceMember, {
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  member!: Ref<WorkspaceMember>;
}
