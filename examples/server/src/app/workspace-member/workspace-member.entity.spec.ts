vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { BaseWorkspaceMember } from '@nest-boot/auth';
import {
  getPolicyDefinitions,
  PolicyCommand,
} from '@nest-boot/row-level-security';

import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { WorkspaceMember } from './workspace-member.entity.js';

describe('WorkspaceMember', () => {
  it('extends the auth workspace-member base entity', () => {
    expect(new WorkspaceMember()).toBeInstanceOf(BaseWorkspaceMember);
  });

  it('defaults to a user member', () => {
    const member = new WorkspaceMember();

    expect(member.type).toBe(WorkspaceMemberType.USER);
    expect(member.permissions).toEqual([]);
  });

  it('uses simple workspace and user row-level security policies', () => {
    const policies = getPolicyDefinitions(WorkspaceMember, {
      entityName: 'WorkspaceMember',
      schemaName: 'public',
      tableName: 'workspace_member',
      properties: {
        user: {
          fieldNames: ['user_id'],
          columnTypes: ['bigint'],
        },
        workspace: {
          fieldNames: ['workspace_id'],
          columnTypes: ['bigint'],
        },
      },
    });

    expect(policies).toHaveLength(2);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'workspace_member_user_all_authenticated_policy',
          command: PolicyCommand.ALL,
          roles: ['authenticated'],
          using: expect.not.stringContaining('invite_token'),
          withCheck: expect.not.stringContaining('invite_token'),
        }),
        expect.objectContaining({
          name: 'workspace_member_workspace_all_authenticated_policy',
          command: PolicyCommand.ALL,
          roles: ['authenticated'],
          using: expect.stringContaining('workspace_id'),
          withCheck: expect.stringContaining('workspace_id'),
        }),
      ]),
    );
  });
});
