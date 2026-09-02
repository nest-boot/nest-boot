import {
  type AuthModuleOptions,
  BaseSession,
  IS_PUBLIC_KEY,
} from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { ExecutionContext } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { Mocked } from 'vitest';

import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  it('allows requests that already have workspace member context', async () => {
    const reflector = createReflector(false);
    const guard = createGuard(reflector);
    const workspaceMember = {
      id: 'member_1',
    } as unknown as WorkspaceMember;

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(WorkspaceMember, workspaceMember);

      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });
  });

  it('falls back to the base session guard', async () => {
    const guard = createGuard(createReflector(false));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(BaseSession, { id: 'session_1' } as BaseSession);

      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });
  });

  it('rejects protected requests without session or workspace member context', async () => {
    const guard = createGuard(createReflector(false));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });
  });

  it('allows public routes through the base guard', async () => {
    const guard = createGuard(createReflector(true));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });
  });
});

function createReflector(isPublic: boolean) {
  return {
    getAllAndOverride: vi.fn((key) => key === IS_PUBLIC_KEY && isPublic),
  } as unknown as Mocked<Reflector>;
}

function createGuard(reflector: Reflector) {
  return new AuthGuard(reflector, {} as AuthModuleOptions, {} as ModuleRef);
}

function createContext() {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
}
