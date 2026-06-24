vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { RequestContext } from '@nest-boot/request-context';
import { Request, Response } from 'express';

import { Workspace } from './workspace.entity.js';
import { WorkspaceMiddleware } from './workspace.middleware.js';

describe('WorkspaceMiddleware', () => {
  it('does nothing when the request does not select a workspace', async () => {
    const { em, middleware } = createMiddleware();
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(createRequest(), createResponse(), next);

      expect(RequestContext.get(Workspace)).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('sets the selected workspace id and entity for anonymous requests', async () => {
    const workspaceId = 'workspace_1';
    const workspace = { id: workspaceId } as Workspace;
    const { em, middleware } = createMiddleware({
      findOne: vi.fn(async () => workspace),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(
        createRequest({
          headers: {
            'x-workspace-id': workspaceId,
          },
        }),
        createResponse(),
        next,
      );

      expect(RequestContext.get(Workspace)).toBe(workspace);
      expect(next).toHaveBeenCalledWith();
    });

    expect(em.findOne).toHaveBeenCalledWith(Workspace, {
      id: workspaceId,
      deletedAt: null,
    });
  });

  it('reads the selected workspace from parsed cookies', async () => {
    const workspaceId = 'workspace_cookie';
    const workspace = { id: workspaceId } as Workspace;
    const { middleware } = createMiddleware({
      findOne: vi.fn(async () => workspace),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(
        createRequest({
          cookies: {
            workspace_id: workspaceId,
          },
        }),
        createResponse(),
        next,
      );

      expect(RequestContext.get(Workspace)).toBe(workspace);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('prefers x-workspace-id over cookies', async () => {
    const workspaceId = 'workspace_header';
    const workspace = { id: workspaceId } as Workspace;
    const { em, middleware } = createMiddleware({
      findOne: vi.fn(async () => workspace),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(
        createRequest({
          headers: {
            'x-workspace-id': workspaceId,
          },
          cookies: {
            workspace_id: 'workspace_cookie',
          },
        }),
        createResponse(),
        next,
      );

      expect(RequestContext.get(Workspace)).toBe(workspace);
      expect(next).toHaveBeenCalledWith();
    });

    expect(em.findOne).toHaveBeenCalledWith(Workspace, {
      id: workspaceId,
      deletedAt: null,
    });
  });

  it('does not set workspace context when the workspace is not found', async () => {
    const workspaceId = 'missing_workspace';
    const { middleware } = createMiddleware({
      findOne: vi.fn(async () => null),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(
        createRequest({
          headers: {
            'x-workspace-id': workspaceId,
          },
        }),
        createResponse(),
        next,
      );

      expect(RequestContext.get(Workspace)).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('passes query errors to next', async () => {
    const error = new Error('query failed');
    const { middleware } = createMiddleware({
      findOne: vi.fn(async () => {
        throw error;
      }),
    });
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await middleware.use(
        createRequest({
          headers: {
            'x-workspace-id': 'workspace_1',
          },
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

function createMiddleware(
  overrides: {
    findOne?: Mock;
  } = {},
) {
  const em = {
    findOne: vi.fn(),
    ...overrides,
  };

  return {
    em,
    middleware: new WorkspaceMiddleware(em as never),
  };
}

function createRequest(request: Partial<Request> = {}) {
  return {
    headers: {},
    ...request,
  } as Request;
}

function createResponse() {
  return {} as Response;
}
