import type { Opt, Ref } from '@mikro-orm/core';
import { t } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { FullTextType } from '@mikro-orm/postgresql';
import { BaseWorkspaceMember } from '@nest-boot/auth';
import { Field, HideField, ID, ObjectType } from '@nest-boot/graphql';
import { Policy } from '@nest-boot/row-level-security';
import { Sonyflake } from 'sonyflake-js';

import { SearchableProperty } from '../../common/decorators/searchable-property.decorator.js';
import type { User } from '../user/user.entity.js';
import type { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';

/**
 * 工作区成员实体。
 */
@ObjectType()
@Policy({
  property: 'user',
  context: 'user_id',
  roles: ['authenticated'],
})
@Policy({
  property: 'workspace',
  context: 'workspace_id',
  roles: ['authenticated'],
})
@Entity()
@Unique({ properties: ['user', 'workspace'] })
@Unique({ properties: ['email', 'workspace'] })
@Index({ properties: ['createdAt'] })
@Index({ properties: ['user'] })
@Index({ properties: ['workspace'] })
@Index({ properties: ['type'] })
@Index({ properties: ['searchableName'], type: 'fulltext' })
export class WorkspaceMember extends BaseWorkspaceMember {
  /** 工作区成员唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({
    type: t.bigint,
  })
  override id: Opt<string> = Sonyflake.next().toString();

  /** 成员显示名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare name: string;

  /** 成员邮箱。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.string, nullable: true })
  override email?: Opt<string> | null = null;

  /** 用于全文搜索的成员名称分词字段。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @HideField()
  @SearchableProperty({
    type: FullTextType,
    properties: ['name'],
    nullable: true,
  })
  searchableName?: string;

  /** 成员类型。 */
  @Field(() => WorkspaceMemberType)
  @Enum({
    items: () => WorkspaceMemberType,
    default: WorkspaceMemberType.USER,
  })
  type: Opt<WorkspaceMemberType> = WorkspaceMemberType.USER;

  /** 成员角色。 */
  @Field(() => [String])
  @Property({ type: t.array, defaultRaw: "'{member}'" })
  override roles: Opt<string[]> = ['member'];

  /** 额外授予成员的工作区域权限。 */
  @Field(() => [String])
  @Property({ type: t.array, defaultRaw: "'{}'" })
  override permissions: Opt<string[]> = [];

  /** 成员状态。 */
  @Field(() => WorkspaceMemberStatus)
  @Enum({
    items: () => WorkspaceMemberStatus,
    default: WorkspaceMemberStatus.ACTIVE,
  })
  override status: Opt<WorkspaceMemberStatus> = WorkspaceMemberStatus.ACTIVE;

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

  /** 成员绑定的用户；服务账号为空。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types, @nest-boot/graphql-field-config-from-types
  declare user?: Ref<User> | null;

  /** 成员所属工作区。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types, @nest-boot/graphql-field-config-from-types
  declare workspace: Ref<Workspace>;
}
