vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/core';

import { WorkspaceMemberGroupMemberService } from './workspace-member-group-member.service.js';

describe('WorkspaceMemberGroupMemberService', () => {
  it('can be constructed with an entity manager', () => {
    const service = new WorkspaceMemberGroupMemberService({} as EntityManager);

    expect(service).toBeInstanceOf(WorkspaceMemberGroupMemberService);
  });
});
