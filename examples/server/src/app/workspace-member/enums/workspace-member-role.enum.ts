import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区成员角色。
 */
export enum WorkspaceMemberRole {
  /** 工作区所有者。 */
  OWNER = 'OWNER',
  /** 工作区管理员。 */
  ADMIN = 'ADMIN',
  /** 普通成员。 */
  MEMBER = 'MEMBER',
}

registerEnumType(WorkspaceMemberRole, {
  name: 'WorkspaceMemberRole',
});
