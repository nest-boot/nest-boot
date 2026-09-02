import { Field, ObjectType } from '@nest-boot/graphql';
import { ID } from '@nest-boot/graphql';

import { WorkspaceMember } from '../workspace-member.entity.js';

/** 接受工作区邀请后的返回结果。 */
@ObjectType()
export class AcceptWorkspaceInviteResult {
  /** 接受邀请后激活的工作区成员。 */
  @Field(() => WorkspaceMember)
  workspaceMember!: WorkspaceMember;

  /** 成员加入的工作区 ID。 */
  @Field(() => ID)
  workspaceId!: string;
}
