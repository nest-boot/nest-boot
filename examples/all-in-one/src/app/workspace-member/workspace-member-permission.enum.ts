import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区成员可授予的细粒度权限。
 */
export enum WorkspaceMemberPermission {
  /** 管理工作区基础信息。 */
  MANAGE_WORKSPACE = 'MANAGE_WORKSPACE',
  /** 管理工作区成员。 */
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
}

registerEnumType(WorkspaceMemberPermission, {
  name: 'WorkspacePermission',
});
