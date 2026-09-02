import { Field, ObjectType } from '@nest-boot/graphql';

import { WorkspaceInvitation } from '../workspace-invitation.entity.js';
import { WorkspaceMember } from '../workspace-member.entity.js';

/** 接受工作区邀请后的返回结果。 */
@ObjectType()
export class AcceptWorkspaceInvitationResult {
  /** 已标记为接受的邀请。 */
  @Field(() => WorkspaceInvitation)
  invitation!: WorkspaceInvitation;

  /** 接受邀请时创建的工作区成员。 */
  @Field(() => WorkspaceMember)
  member!: WorkspaceMember;
}
