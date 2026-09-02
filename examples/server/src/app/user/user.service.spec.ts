vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/core';

import { UserService } from './user.service.js';

describe('UserService', () => {
  it('can be constructed with an entity manager', () => {
    const service = new UserService({} as EntityManager);

    expect(service).toBeInstanceOf(UserService);
  });
});
