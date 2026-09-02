import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区成员状态。
 */
export enum WorkspaceMemberStatus {
  /** 正常可用。 */
  ACTIVE = 'ACTIVE',
  /** 等待被邀请用户接受。 */
  INVITING = 'INVITING',
  /** 邀请已经过期。 */
  INVITE_EXPIRED = 'INVITE_EXPIRED',
  /** 已禁用。 */
  DISABLED = 'DISABLED',
}

registerEnumType(WorkspaceMemberStatus, {
  name: 'WorkspaceMemberStatus',
});
