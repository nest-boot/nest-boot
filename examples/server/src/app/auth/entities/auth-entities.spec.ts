vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseAccount: class BaseAccount {},
  BaseSession: class BaseSession {},
  BaseVerification: class BaseVerification {},
}));

import { Account, Session, Verification } from '@nest-boot/auth';

describe('Auth entities', () => {
  it('constructs Better Auth entity extensions', () => {
    expect(new Account()).toBeInstanceOf(Account);
    expect(new Session()).toBeInstanceOf(Session);
    expect(new Verification()).toBeInstanceOf(Verification);
  });
});
