vi.mock('@nest-boot/auth', () => ({
  BaseAccount: class BaseAccount {},
  BaseSession: class BaseSession {},
  BaseVerification: class BaseVerification {},
}));

import { Account } from './account.entity.js';
import { Session } from './session.entity.js';
import { Verification } from './verification.entity.js';

describe('Auth entities', () => {
  it('constructs Better Auth entity extensions', () => {
    expect(new Account()).toBeInstanceOf(Account);
    expect(new Session()).toBeInstanceOf(Session);
    expect(new Verification()).toBeInstanceOf(Verification);
  });
});
