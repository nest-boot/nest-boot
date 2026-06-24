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
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberPermission } from '../workspace-member/workspace-member-permission.enum.js';
import { WorkspaceMemberGroupMember } from '../workspace-member-group-member/workspace-member-group-member.entity.js';

/** 工作区成员组实体。 */
@ObjectType()
@Policy({
  property: 'workspace',
  context: 'workspace_id',
  roles: ['authenticated', 'anonymous'],
})
@Entity()
@Unique({ properties: ['name', 'workspace'] })
@Index({ properties: ['createdAt'] })
@Index({ properties: ['searchableName'], type: 'fulltext' })
@Index({ properties: ['searchableDescription'], type: 'fulltext' })
export class WorkspaceMemberGroup {
  /** 成员组唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({
    type: t.bigint,
  })
  id: Opt<string> = Sonyflake.next().toString();

  /** 成员组名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  name!: string;

  /** 用于全文搜索的成员组名称分词字段。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @HideField()
  @SearchableProperty({
    type: FullTextType,
    properties: ['name'],
    nullable: true,
  })
  searchableName?: string;

  /** 成员组描述。 */
  @Field(() => String, { nullable: true })
  @Property({ type: t.text, nullable: true })
  description?: string;

  /** 用于全文搜索的成员组描述分词字段。 */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @HideField()
  @SearchableProperty({
    type: FullTextType,
    properties: ['description'],
    nullable: true,
  })
  searchableDescription?: string;

  /** 成员组授予的权限列表。 */
  @Field(() => [WorkspaceMemberPermission])
  @Enum({
    array: true,
    items: () => WorkspaceMemberPermission,
    default: [],
  })
  permissions: Opt<WorkspaceMemberPermission[]> = [];

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

  /** 成员组所属工作区。 */
  @ManyToOne(() => Workspace, { updateRule: 'cascade', deleteRule: 'cascade' })
  workspace!: Ref<Workspace>;

  /** 成员组与成员之间的关联集合。 */
  @OneToMany(
    () => WorkspaceMemberGroupMember,
    (workspaceMemberGroupMember) => workspaceMemberGroupMember.group,
  )
  groupMembers = new Collection<WorkspaceMemberGroupMember>(this);
}
