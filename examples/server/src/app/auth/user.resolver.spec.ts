import type { UserService } from '@nest-boot/auth';
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
});

function createResolver(overrides: Partial<UserService> = {}) {
  const service = { ...overrides } as unknown as Mocked<UserService>;
  return {
    resolver: new UserResolver(service as never),
    service,
  };
}
