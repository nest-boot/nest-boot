import { registerEnumType } from '@nest-boot/graphql';

/** 工作区邀请状态。 */
export enum WorkspaceInvitationStatus {
  /** 已接受。 */
  ACCEPTED = 'accepted',
  /** 已取消。 */
  CANCELED = 'canceled',
  /** 等待处理。 */
  PENDING = 'pending',
  /** 已拒绝。 */
  REJECTED = 'rejected',
}

registerEnumType(WorkspaceInvitationStatus, {
  name: 'WorkspaceInvitationStatus',
});
