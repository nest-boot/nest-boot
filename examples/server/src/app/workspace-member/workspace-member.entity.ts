import type { Opt, Ref } from '@mikro-orm/core';
import { Collection, t } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { FullTextType } from '@mikro-orm/postgresql';
import { Field, HideField, ID, ObjectType } from '@nest-boot/graphql';
import { Policy } from '@nest-boot/row-level-security';
import { Sonyflake } from 'sonyflake-js';

import { SearchableProperty } from '../../common/decorators/searchable-property.decorator.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberGroupMember } from '../workspace-member-group-member/workspace-member-group-member.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { WorkspaceMemberPermission } from './workspace-member-permission.enum.js';

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
@Unique({ properties: ['inviteToken', 'workspace'] })
@Unique({ properties: ['email', 'workspace'] })
@Index({ properties: ['role'] })
@Index({ properties: ['inviteToken'] })
@Index({ properties: ['createdAt'] })
@Index({ properties: ['user'] })
@Index({ properties: ['workspace'] })
@Index({ properties: ['type'] })
@Index({ properties: ['searchableName'], type: 'fulltext' })
export class WorkspaceMember {
  /** 工作区成员唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({
    type: t.bigint,
  })
  id: Opt<string> = Sonyflake.next().toString();

  /** 成员显示名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  name!: string;

  /** 成员邮箱。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.string, nullable: true })
  email?: Opt<string> | null = null;

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
  @Field(() => WorkspaceMemberRole)
  @Enum({
    items: () => WorkspaceMemberRole,
    default: WorkspaceMemberRole.MEMBER,
  })
  role: Opt<WorkspaceMemberRole> = WorkspaceMemberRole.MEMBER;

  /** 成员直接拥有的权限列表。 */
  @Field(() => [WorkspaceMemberPermission])
  @Enum({
    array: true,
    items: () => WorkspaceMemberPermission,
    default: [],
  })
  permissions: Opt<WorkspaceMemberPermission[]> = [];

  /** 邀请者，删除时设置为空值。 */
  @ManyToOne(() => User, { nullable: true, deleteRule: 'set null' })
  invitedBy?: Ref<User>;

  /** 存储邀请者名称，避免 `invitedBy` 被删除后丢失邀请者信息。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.string, nullable: true })
  invitedByUserName?: Opt<string> | null = null;

  /** 邀请令牌，用于邀请用户加入工作区。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.text, nullable: true })
  inviteToken?: Opt<string> | null = null;

  /** 成员状态。 */
  @Field(() => WorkspaceMemberStatus)
  @Enum({
    items: () => WorkspaceMemberStatus,
    default: WorkspaceMemberStatus.ACTIVE,
  })
  status: Opt<WorkspaceMemberStatus> = WorkspaceMemberStatus.ACTIVE;

  /** 邀请过期时间。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  inviteExpiresAt?: Opt<Date> | null = null;

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

  /** 成员绑定的用户；服务账号和未接受邀请时为空。 */
  @ManyToOne({ updateRule: 'cascade', deleteRule: 'cascade', nullable: true })
  user?: Ref<User>;

  /** 成员所属工作区。 */
  @ManyToOne({ updateRule: 'cascade', deleteRule: 'cascade' })
  workspace!: Ref<Workspace>;

  /** 成员所属的成员组关系集合。 */
  @OneToMany(
    () => WorkspaceMemberGroupMember,
    (groupMember) => groupMember.member,
  )
  groupMembers = new Collection<WorkspaceMemberGroupMember>(this);
}
