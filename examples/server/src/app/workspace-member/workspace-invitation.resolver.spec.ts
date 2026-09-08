import type { WorkspaceService } from '@nest-boot/auth';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mocked } from 'vitest';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
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
      roles: ['member'],
    };
    const { resolver, workspaceService } = createResolver({
      createInvitation: vi.fn(async () => invitation),
    });

    await expect(
      resolver.createWorkspaceInvitation(
        workspace,
        { roles: ['admin'] } as WorkspaceMember,
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

  it('rejects owner invitations created by non owners', async () => {
    const { resolver, workspaceService } = createResolver();

    await expect(
      resolver.createWorkspaceInvitation(
        { id: 'workspace_1' } as Workspace,
        { roles: ['member'] } as WorkspaceMember,
        { id: 'user_1' } as User,
        {
          email: 'invited@example.com',
          roles: ['owner'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaceService.createInvitation).not.toHaveBeenCalled();
  });

  it('scopes invitation lookup to the current user email', async () => {
    const user = { id: 'user_1' } as User;
    const invitation = { id: 'invitation_1' } as WorkspaceInvitation;
    const { resolver, workspaceService } = createResolver({
      getUserInvitation: vi.fn(async () => invitation),
    });

    await expect(
      resolver.workspaceInvitation(invitation.id, user),
    ).resolves.toBe(invitation);
    expect(workspaceService.getUserInvitation).toHaveBeenCalledWith(
      invitation.id,
      user,
    );
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

  it('lists invitations addressed to the current user', async () => {
    const user = { id: 'user_1' } as User;
    const invitations = [
      { id: 'invitation_1' } as WorkspaceInvitation,
      { id: 'invitation_2' } as WorkspaceInvitation,
    ];
    const { resolver, workspaceService } = createResolver({
      listUserInvitations: vi.fn(async () => invitations),
    });

    await expect(resolver.currentUserWorkspaceInvitations(user)).resolves.toBe(
      invitations,
    );
    expect(workspaceService.listUserInvitations).toHaveBeenCalledWith(user);
  });

  it('rejects an invitation addressed to the current user', async () => {
    const user = { id: 'user_1' } as User;
    const invitation = { id: 'invitation_1' } as WorkspaceInvitation;
    const rejectedInvitation = {
      ...invitation,
      status: 'rejected',
    } as WorkspaceInvitation;
    const { resolver, workspaceService } = createResolver({
      getUserInvitation: vi.fn(async () => invitation),
      rejectInvitation: vi.fn(async () => rejectedInvitation),
    });

    await expect(
      resolver.rejectWorkspaceInvitation(invitation.id, user),
    ).resolves.toBe(rejectedInvitation);
    expect(workspaceService.rejectInvitation).toHaveBeenCalledWith(
      user,
      invitation,
    );
  });

  it('reports missing invitations when rejecting', async () => {
    const { resolver, workspaceService } = createResolver({
      getUserInvitation: vi.fn(async () => null),
    });

    await expect(
      resolver.rejectWorkspaceInvitation('missing', {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(workspaceService.rejectInvitation).not.toHaveBeenCalled();
  });

  it('does not reveal or cancel an invitation from another workspace', async () => {
    const invitation = {
      id: 'invitation_1',
      workspace: { id: 'workspace_2' },
    } as WorkspaceInvitation;
    const { resolver, workspaceService } = createResolver({
      getWorkspaceInvitation: vi.fn(async () => null),
    });

    await expect(
      resolver.cancelWorkspaceInvitation(invitation.id, {
        id: 'workspace_1',
      } as Workspace),
    ).rejects.toBeInstanceOf(NotFoundException);
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
    getUserInvitation: vi.fn(),
    getWorkspaceInvitation: vi.fn(),
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
