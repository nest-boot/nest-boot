import type { Mocked } from 'vitest';
vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { RequestContext } from '@nest-boot/request-context';
import { Request, Response } from 'express';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberMiddleware } from './workspace-member.middleware.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

describe('WorkspaceMemberMiddleware', () => {
  it('does nothing without an authenticated user and selected workspace', async () => {
    const { middleware, workspaceMemberService } = createMiddleware();
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(createRequest(), createResponse(), next);

      expect(RequestContext.get(WorkspaceMember)).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    expect(workspaceMemberService.findOne).not.toHaveBeenCalled();
  });

  it('keeps an existing workspace member context', async () => {
    const workspaceMember = {
      id: 'member_api_key',
    } as unknown as WorkspaceMember;
    const { middleware, workspaceMemberService } = createMiddleware();
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(WorkspaceMember, workspaceMember);

      await middleware.use(createRequest(), createResponse(), next);

      expect(RequestContext.get(WorkspaceMember)).toBe(workspaceMember);
      expect(next).toHaveBeenCalledWith();
    });

    expect(workspaceMemberService.findOne).not.toHaveBeenCalled();
  });

  it('sets the current workspace member for session requests', async () => {
    const user = { id: 'user_1' } as User;
    const workspace = { id: 'workspace_1' } as Workspace;
    const workspaceMember = {
      id: 'member_1',
    } as unknown as WorkspaceMember;
    const { middleware, workspaceMemberService } = createMiddleware({
      findOne: vi.fn(async () => workspaceMember),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(User, user);
      RequestContext.set(Workspace, workspace);

      await middleware.use(createRequest(), createResponse(), next);

      expect(RequestContext.get(WorkspaceMember)).toBe(workspaceMember);
      expect(next).toHaveBeenCalledWith();
    });

    expect(workspaceMemberService.findOne).toHaveBeenCalledWith({
      user,
      workspace,
    });
  });

  it('does not set workspace member context when the user is not a member', async () => {
    const { middleware, workspaceMemberService } = createMiddleware({
      findOne: vi.fn(async () => null),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(User, { id: 'user_1' } as User);
      RequestContext.set(Workspace, { id: 'workspace_1' } as Workspace);

      await middleware.use(createRequest(), createResponse(), next);

      expect(RequestContext.get(WorkspaceMember)).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    expect(workspaceMemberService.findOne).toHaveBeenCalledTimes(1);
  });
});

function createMiddleware(
  overrides: {
    findOne?: Mock;
  } = {},
) {
  const workspaceMemberService = {
    findOne: vi.fn(),
    ...overrides,
  } as unknown as Mocked<WorkspaceMemberService>;

  return {
    workspaceMemberService,
    middleware: new WorkspaceMemberMiddleware(workspaceMemberService),
  };
}

function createRequest() {
  return {} as Request;
}

function createResponse() {
  return {} as Response;
}
