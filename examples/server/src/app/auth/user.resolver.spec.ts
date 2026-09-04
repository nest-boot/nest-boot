import type { SessionService, UserService } from '@nest-boot/auth';
import type { Response } from 'express';
import type { Mocked } from 'vitest';

vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  UserService: class UserService {},
  BaseUser: class BaseUser {},
  UserCan: () => () => undefined,
}));

import { User } from '../user/user.entity.js';
import { UserResolver } from './user.resolver.js';

describe('UserResolver', () => {
  it('lists users with bounded offset pagination', async () => {
    const user = { id: 'user-1' } as User;
    const { resolver, service } = createResolver({
      listUsers: vi.fn(async () => ({
        users: [user],
        total: 1,
        limit: 10,
        offset: 20,
      })),
    });

    await expect(
      resolver.users({ limit: 10, offset: 20, search: 'alice' }),
    ).resolves.toEqual({ users: [user], total: 1, limit: 10, offset: 20 });
    expect(service.listUsers).toHaveBeenCalledWith({
      limit: 10,
      offset: 20,
      searchValue: 'alice',
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
  });

  it('updates permissions through UserService', async () => {
    const user = { id: 'user-1' } as User;
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      setUserPermissions: vi.fn(async () => user),
    });

    await expect(
      resolver.setUserPermissions(user.id, {
        permissions: ['user:list'],
      }),
    ).resolves.toBe(user);
    expect(service.setUserPermissions).toHaveBeenCalledWith(user, [
      'user:list',
    ]);
  });

  it('lists configured roles and updates a user role', async () => {
    const user = { id: 'user-1' } as User;
    const roles = [{ name: 'admin', permissions: ['user:list'] }];
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      listPermissions: vi.fn(() => ['user:list']),
      listRoles: vi.fn(() => roles),
      setRole: vi.fn(async () => user),
    });

    expect(resolver.userRoles()).toEqual(roles);
    expect(resolver.userPermissions()).toEqual(['user:list']);
    await expect(
      resolver.setUserRoles(user.id, { roles: ['admin'] }),
    ).resolves.toBe(user);
    expect(service.setRole).toHaveBeenCalledWith(user, ['admin']);
  });

  it('manages user sessions without exposing missing users', async () => {
    const user = { id: 'user-1' } as User;
    const session = {
      id: 'session-1',
      token: 'token-1',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      listUserSessions: vi.fn(async () => [session]),
      revokeUserSession: vi.fn(async () => true),
    });

    await expect(resolver.userSessions(user.id)).resolves.toEqual([
      expect.objectContaining({ current: false, id: session.id }),
    ]);
    await expect(
      resolver.revokeUserSession(user.id, session.token),
    ).resolves.toBe(true);
    expect(service.revokeUserSession).toHaveBeenCalledWith(user, session.token);
  });

  it('starts and stops impersonation while forwarding signed cookies', async () => {
    const administrator = { id: 'admin-1' } as User;
    const target = { id: 'user-1' } as User;
    const session = { token: 'impersonation-token' };
    const restoredSession = { token: 'restored-token' };
    const responseHeaders = new Headers({
      'set-cookie': 'better-auth.session_token=signed; Path=/',
    });
    const { resolver, service, sessionService } = createResolver(
      {
        getUser: vi.fn(async () => target),
        impersonateUser: vi.fn(async () => ({ session, user: target })),
        stopImpersonating: vi.fn(async () => ({
          session: restoredSession,
          user: administrator,
        })),
      },
      {
        createSessionHeaders: vi.fn(async () => responseHeaders),
      },
    );
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.impersonateUser(target.id, administrator, response),
    ).resolves.toBe(target);
    expect(service.impersonateUser).toHaveBeenCalledWith(administrator, target);
    expect(sessionService.createSessionHeaders).toHaveBeenCalledWith(
      session.token,
    );

    await expect(
      resolver.stopImpersonating(restoredSession as never, response),
    ).resolves.toBe(administrator);
    expect(service.stopImpersonating).toHaveBeenCalledWith(restoredSession);
    expect(response.append).toHaveBeenCalledTimes(2);
  });
});

function createResolver(
  overrides: Partial<UserService> = {},
  sessionOverrides: Partial<SessionService> = {},
) {
  const service = { ...overrides } as unknown as Mocked<UserService>;
  const sessionService = {
    ...sessionOverrides,
  } as unknown as Mocked<SessionService>;
  return {
    resolver: new UserResolver(service as never, sessionService),
    service,
    sessionService,
  };
}
