import type { Mocked } from 'vitest';
vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { RequestContext } from '@nest-boot/request-context';
import { RowLevelSecurity } from '@nest-boot/row-level-security';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { RowLevelSecurityInterceptor } from './row-level-security.interceptor.js';

describe('RowLevelSecurityInterceptor', () => {
  it('sets request row level security context from request context', async () => {
    const { interceptor } = createInterceptor();
    const next = createNext();
    const user = { id: 'user_1' } as User;
    const workspace = { id: 'workspace_1' } as Workspace;

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(User, user);
      RequestContext.set(Workspace, workspace);

      await lastValueFrom(interceptor.intercept(createContext(), next));

      expect(RowLevelSecurity.getContext('user_id')).toBe(user.id);
      expect(RowLevelSecurity.getContext('workspace_id')).toBe(workspace.id);
      expect(RowLevelSecurity.getRole()).toBe('authenticated');
      expect(next.handle).toHaveBeenCalledWith();
    });
  });

  it('sets authenticated role for API key workspace member requests', async () => {
    const { interceptor } = createInterceptor();
    const next = createNext();
    const workspaceMember = { id: 'member_1' } as unknown as WorkspaceMember;

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(WorkspaceMember, workspaceMember);

      await lastValueFrom(interceptor.intercept(createContext(), next));

      expect(RowLevelSecurity.getContext('user_id')).toBeUndefined();
      expect(RowLevelSecurity.getRole()).toBe('authenticated');
      expect(next.handle).toHaveBeenCalledWith();
    });
  });

  it('leaves anonymous requests without authenticated role', async () => {
    const { interceptor } = createInterceptor();
    const next = createNext();

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await lastValueFrom(interceptor.intercept(createContext(), next));

      expect(RowLevelSecurity.getRole()).toBeUndefined();
      expect(next.handle).toHaveBeenCalledWith();
    });
  });
});

function createInterceptor() {
  return {
    interceptor: new RowLevelSecurityInterceptor(),
  };
}

function createContext() {
  return {} as ExecutionContext;
}

function createNext() {
  return {
    handle: vi.fn(() => of('ok')),
  } as unknown as Mocked<CallHandler>;
}
