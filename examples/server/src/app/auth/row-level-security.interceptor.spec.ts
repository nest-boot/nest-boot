import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '@nest-boot/request-context';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { ApiKey } from '../api-key/api-key.entity.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { RowLevelSecurityInterceptor } from './row-level-security.interceptor.js';

describe('RowLevelSecurityInterceptor', () => {
  it.each(['member', 'workspace-key', 'anonymous', 'non-member'] as const)(
    'stages the native database session for a %s',
    async (kind) => {
      const em = { setSessionContext: vi.fn() };
      const interceptor = new RowLevelSecurityInterceptor(
        em as unknown as EntityManager,
      );
      const next: CallHandler = { handle: vi.fn(() => of('ok')) };

      await RequestContext.run(
        new RequestContext({ type: 'http' }),
        async () => {
          RequestContext.set(Workspace, { id: '42' } as Workspace);
          if (kind === 'member' || kind === 'non-member') {
            RequestContext.set(User, { id: '7' } as User);
          }
          if (kind === 'member') {
            RequestContext.set(WorkspaceMember, { id: '9' } as WorkspaceMember);
          }
          if (kind === 'workspace-key') {
            RequestContext.set(ApiKey, { id: '11' } as ApiKey);
          }

          await expect(
            lastValueFrom(interceptor.intercept({} as ExecutionContext, next)),
          ).resolves.toBe('ok');
          expect(em.setSessionContext).toHaveBeenCalledWith({
            role: kind === 'anonymous' ? 'anonymous' : 'authenticated',
            variables: {
              'app.user_id':
                kind === 'member' || kind === 'non-member' ? '7' : '',
              'app.workspace': kind === 'non-member' ? '' : '42',
            },
          });
        },
      );
    },
  );

  it('does not stage a session outside a request context', async () => {
    const em = { setSessionContext: vi.fn() };
    const interceptor = new RowLevelSecurityInterceptor(
      em as unknown as EntityManager,
    );
    await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, { handle: () => of('ok') }),
    );
    expect(em.setSessionContext).not.toHaveBeenCalled();
  });
});
