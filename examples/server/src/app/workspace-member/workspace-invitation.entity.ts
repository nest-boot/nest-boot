import { randomUUID } from 'node:crypto';

import type { Opt, Ref } from '@mikro-orm/core';
import { t } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { BaseWorkspaceInvitation } from '@nest-boot/auth';
import { Field, ID, ObjectType } from '@nest-boot/graphql';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceInvitationStatus } from './enums/workspace-invitation-status.enum.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';

/** 独立于成员记录的工作区邀请。 */
@ObjectType()
@Entity()
@Index({ properties: ['createdAt'] })
@Index({ properties: ['email'] })
@Index({ properties: ['status'] })
@Index({ properties: ['workspace'] })
export class WorkspaceInvitation extends BaseWorkspaceInvitation {
  /** 邀请唯一标识，同时用于接受、拒绝和取消邀请。 */
  @Field(() => ID)
  @PrimaryKey({ type: t.uuid })
  override id: Opt<string> = randomUUID();

  /** 允许接受邀请的邮箱地址。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare email: string;

  /** 接受邀请后授予的成员角色。 */
  @Field(() => WorkspaceMemberRole)
  @Enum({
    items: () => WorkspaceMemberRole,
    default: WorkspaceMemberRole.MEMBER,
  })
  override role: Opt<WorkspaceMemberRole> = WorkspaceMemberRole.MEMBER;

  /** 邀请生命周期状态。 */
  @Field(() => WorkspaceInvitationStatus)
  @Enum({
    items: () => WorkspaceInvitationStatus,
    default: WorkspaceInvitationStatus.PENDING,
  })
  override status: Opt<WorkspaceInvitationStatus> =
    WorkspaceInvitationStatus.PENDING;

  /** 邀请过期时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime })
  declare expiresAt: Date;

  /** 邀请创建时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  override createdAt: Opt<Date> = new Date();

  /** 发出邀请的用户。 */
  @ManyToOne(() => User, { updateRule: 'cascade', deleteRule: 'cascade' })
  declare inviter: Ref<User>;

  /** 邀请所属工作区。 */
  @ManyToOne(() => Workspace, {
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  declare workspace: Ref<Workspace>;
}
