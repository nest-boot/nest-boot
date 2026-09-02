import { registerEnumType } from '@nest-boot/graphql';

import { UserPermission } from './user-permission.enum.js';
import { WorkspacePermission } from './workspace-permission.enum.js';

/** GraphQL enum values accepted by user-owned API keys and users. */
export const AuthPermissionEnum = {
  ...UserPermission,
  ...WorkspacePermission,
} as const;

registerEnumType(AuthPermissionEnum, {
  name: 'AuthPermission',
});

registerEnumType(UserPermission, {
  name: 'UserPermission',
});

registerEnumType(WorkspacePermission, {
  name: 'WorkspacePermission',
});
