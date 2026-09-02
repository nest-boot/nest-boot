import type { WorkspaceService } from '@nest-boot/auth';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mocked } from 'vitest';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { WorkspaceInvitation } from './workspace-invitation.entity.js';
import { WorkspaceInvitationResolver } from './workspace-invitation.resolver.js';
import { WorkspaceMember } from './workspace-member.entity.js';

describe('WorkspaceInvitationResolver', () => {
  it('creates a separate invitation through WorkspaceService', async () => {
    const invitation = { id: 'invitation_1' } as WorkspaceInvitation;
    const workspace = { id: 'workspace_1' } as Workspace;
    const user = { id: 'user_1' } as User;
    const input = {
      email: 'invited@example.com',
      role: WorkspaceMemberRole.MEMBER,
    };
    const { resolver, workspaceService } = createResolver({
      createInvitation: vi.fn(async () => invitation),
    });

    await expect(
      resolver.createWorkspaceInvitation(
        workspace,
        { role: WorkspaceMemberRole.ADMIN } as WorkspaceMember,
        user,
        input,
      ),
    ).resolves.toBe(invitation);
    expect(workspaceService.createInvitation).toHaveBeenCalledWith(
      workspace,
      user,
      input,
    );
  });

  it('rejects invitation creation by regular members', async () => {
    const { resolver, workspaceService } = createResolver();

    await expect(
      resolver.createWorkspaceInvitation(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.MEMBER } as WorkspaceMember,
        { id: 'user_1' } as User,
        {
          email: 'invited@example.com',
          role: WorkspaceMemberRole.MEMBER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaceService.createInvitation).not.toHaveBeenCalled();
  });

  it('returns the accepted invitation and newly created member', async () => {
    const invitation = { id: 'invitation_1' } as WorkspaceInvitation;
    const member = { id: 'member_1' } as WorkspaceMember;
    const user = { id: 'user_1' } as User;
    const { resolver, workspaceService } = createResolver({
      acceptInvitation: vi.fn(async () => ({ invitation, member })),
    });

    await expect(
      resolver.acceptWorkspaceInvitation(invitation.id, user),
    ).resolves.toEqual({ invitation, member });
    expect(workspaceService.acceptInvitation).toHaveBeenCalledWith(
      user,
      invitation.id,
    );
  });

  it('reports missing invitations when accepting', async () => {
    const { resolver } = createResolver({
      acceptInvitation: vi.fn(async () => null),
    });

    await expect(
      resolver.acceptWorkspaceInvitation('missing', {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not cancel an invitation from another workspace', async () => {
    const invitation = {
      id: 'invitation_1',
      workspace: { id: 'workspace_2' },
    } as WorkspaceInvitation;
    const { resolver, workspaceService } = createResolver({
      getInvitation: vi.fn(async () => invitation),
    });

    await expect(
      resolver.cancelWorkspaceInvitation(invitation.id, {
        id: 'workspace_1',
      } as Workspace),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaceService.cancelInvitation).not.toHaveBeenCalled();
  });

  it('loads invitation relations', async () => {
    const inviter = { id: 'user_1' } as User;
    const workspace = { id: 'workspace_1' } as Workspace;
    const invitation = {
      inviter: { loadOrFail: vi.fn(async () => inviter) },
      workspace: { loadOrFail: vi.fn(async () => workspace) },
    } as unknown as WorkspaceInvitation;
    const { resolver } = createResolver();

    await expect(resolver.inviter(invitation)).resolves.toBe(inviter);
    await expect(resolver.workspace(invitation)).resolves.toBe(workspace);
  });
});

function createResolver(overrides: Record<string, unknown> = {}) {
  const workspaceService = {
    acceptInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    createInvitation: vi.fn(),
    getInvitation: vi.fn(),
    listInvitations: vi.fn(),
    listUserInvitations: vi.fn(),
    rejectInvitation: vi.fn(),
    ...overrides,
  } as unknown as Mocked<WorkspaceService>;

  return {
    resolver: new WorkspaceInvitationResolver(workspaceService as never),
    workspaceService,
  };
}
