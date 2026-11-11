import type { AuthModuleOptions } from '@nest-boot/auth';

import { Report } from './report.js';

const reportPermissions = ['report:read', 'report:archive'] as const;

/** Merge into AuthModule.forRoot when adopting this optional recipe; the demo app does not register it. */
export const reportAuthOptions = {
  buildAbility: ({ can }, { workspace }) => {
    if (!workspace) {
      return;
    }
    can({ workspace: 'report:read' }, 'read', Report, {
      workspaceId: workspace.id,
    });
    can({ workspace: 'report:archive' }, 'archive', Report, {
      workspaceId: workspace.id,
      archived: false,
    });
  },

  workspace: {
    enabled: true,
    permissions: reportPermissions,
    roles: {
      owner: ['report:read', 'report:archive'],
      'report-reader': ['report:read'],
    },
  },
  apiKey: {
    enabled: true,
    user: {
      enabled: true,
      defaultPermissions: ['report:read'],
      allowedPermissions: reportPermissions,
    },
    workspace: {
      enabled: true,
      defaultPermissions: ['report:read'],
      allowedPermissions: reportPermissions,
    },
  },
} satisfies AuthModuleOptions<
  never,
  (typeof reportPermissions)[number],
  never,
  'report-reader'
>;
