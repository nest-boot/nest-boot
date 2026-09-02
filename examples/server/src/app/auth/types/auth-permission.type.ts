import type { UserPermission } from '../enums/user-permission.enum.js';
import type { WorkspacePermission } from '../enums/workspace-permission.enum.js';

/** 用户 API Key 可使用的用户域与工作区域权限。 */
export type AuthPermission = UserPermission | WorkspacePermission;
