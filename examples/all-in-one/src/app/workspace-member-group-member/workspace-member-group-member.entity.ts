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
import { Policy } from '@nest-boot/row-level-security';
import { Sonyflake } from 'sonyflake-js';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberGroup } from '../workspace-member-group/workspace-member-group.entity.js';

/** 工作区成员与成员组的关联实体。 */
@Policy({
  property: 'workspace',
  context: 'workspace_id',
  roles: ['authenticated'],
})
@Entity()
@Index({ properties: ['createdAt'] })
@Unique({ properties: ['group', 'member'] })
export class WorkspaceMemberGroupMember {
  /** 成员组关系唯一标识。 */
  @PrimaryKey({
    type: t.bigint,
  })
  id: Opt<string> = Sonyflake.next().toString();

  /** 创建时间。 */
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  /** 更新时间。 */
  @Property({
    type: t.datetime,
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** 关联所属工作区。 */
  @ManyToOne(() => Workspace, { updateRule: 'cascade', deleteRule: 'cascade' })
  workspace!: Ref<Workspace>;

  /** 关联的成员组。 */
  @ManyToOne(() => WorkspaceMemberGroup, {
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  group!: Ref<WorkspaceMemberGroup>;

  /** 关联的工作区成员。 */
  @ManyToOne(() => WorkspaceMember, {
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  member!: Ref<WorkspaceMember>;
}
