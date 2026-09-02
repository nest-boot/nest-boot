/** 工作区域权限。 */
export enum WorkspacePermission {
  /** 更新工作区。 */
  WORKSPACE_UPDATE = 'workspace:update',
  /** 删除工作区。 */
  WORKSPACE_DELETE = 'workspace:delete',
  /** 创建工作区成员。 */
  WORKSPACE_MEMBER_CREATE = 'workspaceMember:create',
  /** 更新工作区成员。 */
  WORKSPACE_MEMBER_UPDATE = 'workspaceMember:update',
  /** 删除工作区成员。 */
  WORKSPACE_MEMBER_DELETE = 'workspaceMember:delete',
  /** 创建工作区邀请。 */
  WORKSPACE_INVITATION_CREATE = 'workspaceInvitation:create',
  /** 取消工作区邀请。 */
  WORKSPACE_INVITATION_CANCEL = 'workspaceInvitation:cancel',
}
