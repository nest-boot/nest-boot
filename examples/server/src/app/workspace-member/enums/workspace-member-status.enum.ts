import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区成员状态。
 */
export enum WorkspaceMemberStatus {
  /** 正常可用。 */
  ACTIVE = 'ACTIVE',
  /** 已禁用。 */
  DISABLED = 'DISABLED',
}

registerEnumType(WorkspaceMemberStatus, {
  name: 'WorkspaceMemberStatus',
});
