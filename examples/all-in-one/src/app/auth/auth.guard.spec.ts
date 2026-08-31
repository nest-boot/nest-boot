import { BaseSession } from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Mocked } from 'vitest';

import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  it('allows requests that already have workspace member context', async () => {
    const reflector = createReflector(false);
    const guard = new AuthGuard(reflector);
    const workspaceMember = {
      id: 'member_1',
    } as unknown as WorkspaceMember;

    await RequestContext.run(new RequestContext({ type: 'http' }), () => {
      RequestContext.set(WorkspaceMember, workspaceMember);

      expect(guard.canActivate(createContext())).toBe(true);
      expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
    });
  });

  it('falls back to the base session guard', async () => {
    const guard = new AuthGuard(createReflector(false));

    await RequestContext.run(new RequestContext({ type: 'http' }), () => {
      RequestContext.set(BaseSession, { id: 'session_1' } as BaseSession);

      expect(guard.canActivate(createContext())).toBe(true);
    });
  });

  it('rejects protected requests without session or workspace member context', async () => {
    const guard = new AuthGuard(createReflector(false));

    await RequestContext.run(new RequestContext({ type: 'http' }), () => {
      expect(guard.canActivate(createContext())).toBe(false);
    });
  });

  it('allows public routes through the base guard', async () => {
    const guard = new AuthGuard(createReflector(true));

    await RequestContext.run(new RequestContext({ type: 'http' }), () => {
      expect(guard.canActivate(createContext())).toBe(true);
    });
  });
});

function createReflector(isPublic: boolean) {
  return {
    getAllAndOverride: vi.fn(() => isPublic),
  } as unknown as Mocked<Reflector>;
}

function createContext() {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
}
