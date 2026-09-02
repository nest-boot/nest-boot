vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
  Can: () => () => undefined,
  CurrentUser: () => () => undefined,
  PermissionAction: { READ: 'read' },
}));

import { User } from './user.entity.js';
import { UserResolver } from './user.resolver.js';

describe('UserResolver', () => {
  it('returns the current user from request context', () => {
    const resolver = new UserResolver();
    const user = {
      id: 'user_1',
      name: 'Alice',
      email: 'alice@example.com',
    } as User;

    expect(resolver.currentUser(user)).toBe(user);
  });
});
