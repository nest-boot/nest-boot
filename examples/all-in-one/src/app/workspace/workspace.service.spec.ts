vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/postgresql';
import { RequestContext } from '@nest-boot/request-context';
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from '@nest-boot/row-level-security';

import { User } from '../user/user.entity.js';
import { WorkspaceMemberRole } from '../workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { Workspace } from './workspace.entity.js';
import { WorkspaceService } from './workspace.service.js';

describe('WorkspaceService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a workspace and an owner member for the creator', async () => {
    const persisted: unknown[] = [];
    const em = {
      create: vi.fn((entity, data) => ({ entity, ...data })),
      persist: vi.fn((entity) => {
        persisted.push(entity);
        return em;
      }),
      flush: vi.fn(),
    } as unknown as EntityManager;
    const service = new WorkspaceService(em);
    const user = {
      id: 'user_1',
      name: 'Alice',
      email: 'alice@example.com',
    } as User;

    const workspace = await service.createWorkspace(user, {
      name: 'Acme',
    });

    expect(em.create).toHaveBeenCalledWith(Workspace, { name: 'Acme' });
    expect(em.create).toHaveBeenCalledWith(
      WorkspaceMember,
      expect.objectContaining({
        workspace,
        user,
        name: 'Alice',
        email: 'alice@example.com',
        role: WorkspaceMemberRole.OWNER,
      }),
    );
    expect(persisted).toHaveLength(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(workspace).toMatchObject({
      entity: Workspace,
      name: 'Acme',
    });
  });

  it('flushes a soft delete with RLS disabled only in a child context', async () => {
    const workspace = Object.assign(new Workspace(), { id: 'workspace_1' });
    const em = {
      getUnitOfWork: vi.fn(() => ({
        getById: vi.fn(() => workspace),
      })),
      assign: vi.fn((entity, data) => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
        Object.assign(entity as object, data);
      }),
      flush: vi.fn(async () => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
      }),
    } as unknown as EntityManager;
    const service = new WorkspaceService(em);

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);

      await expect(service.softDelete(workspace)).resolves.toBe(workspace);

      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.ENABLED);
    });

    expect(workspace.deletedAt).toBeInstanceOf(Date);
    expect(em.assign).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        deletedAt: workspace.deletedAt,
      }),
      undefined,
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});
