vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { WorkspaceMemberGroupMember } from './workspace-member-group-member.entity.js';

describe('WorkspaceMemberGroupMember', () => {
  it('initializes identity and timestamps', () => {
    const groupMember = new WorkspaceMemberGroupMember();

    expect(groupMember.id).toEqual(expect.any(String));
    expect(groupMember.createdAt).toBeInstanceOf(Date);
    expect(groupMember.updatedAt).toBeInstanceOf(Date);
  });
});
