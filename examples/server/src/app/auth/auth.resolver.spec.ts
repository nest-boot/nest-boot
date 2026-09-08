import type { AuthService, SessionService } from '@nest-boot/auth';
import { ForbiddenException } from '@nestjs/common';
import type { Mocked } from 'vitest';

vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  AuthService: class AuthService {},
  CurrentUser: () => () => undefined,
  Public: () => () => undefined,
  UserCan: () => () => undefined,
}));

import { User } from '../user/user.entity.js';
import { AuthResolver } from './auth.resolver.js';

describe('AuthResolver', () => {
  it('returns the current authenticated user', () => {
    const { resolver } = createResolver();
    const user = { id: 'user-1' } as User;

    expect(resolver.currentUser(user)).toBe(user);
  });

  it('rejects an authenticated principal without a user identity', () => {
    const { resolver } = createResolver();

    expect(() => resolver.currentUser(null)).toThrow(ForbiddenException);
  });

  it('returns null when API key authentication has no session', () => {
    const { resolver } = createResolver();

    expect(resolver.currentAuthSession(null)).toBeNull();
  });

  it('exposes configured social providers without requiring a session', async () => {
    const { authService, resolver } = createResolver({
      listSocialProviders: vi.fn(async () => [
        { id: 'company', name: 'Company SSO' },
      ]),
    });

    await expect(resolver.authSocialProviders()).resolves.toEqual([
      { id: 'company', name: 'Company SSO' },
    ]);
    expect(authService.listSocialProviders).toHaveBeenCalledWith();
  });

  it('signs in through AuthService', async () => {
    const result = {
      redirect: false,
      token: 'session-token',
      url: null,
      user: { id: 'user-1' },
    };
    const { authService, resolver } = createResolver({
      signIn: vi.fn(async () => result),
    });

    await expect(
      resolver.authSignIn({
        email: 'alice@example.com',
        password: 'password',
      }),
    ).resolves.toBe(result);
    expect(authService.signIn).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password',
    });
  });

  it('starts social sign-in through AuthService', async () => {
    const result = {
      redirect: true,
      token: null,
      url: 'https://identity.example.com/authorize',
      user: null,
    };
    const { authService, resolver } = createResolver({
      signInSocial: vi.fn(async () => result),
    });
    const input = {
      callbackURL: 'https://app.example.com',
      provider: 'company',
    };

    await expect(resolver.authSignInSocial(input)).resolves.toBe(result);
    expect(authService.signInSocial).toHaveBeenCalledWith({
      ...input,
      disableRedirect: true,
    });
  });

  it('delegates provider token operations with an account selector', async () => {
    const token = {
      accessToken: 'access-token',
      accessTokenExpiresAt: null,
      idToken: null,
      scopes: ['openid'],
    };
    const { authService, resolver } = createResolver({
      getAccessToken: vi.fn(async () => token),
    });

    await expect(
      resolver.authAccessToken({ accountId: 'account-1' }),
    ).resolves.toBe(token);
    expect(authService.getAccessToken).toHaveBeenCalledWith({
      accountId: 'account-1',
    });
  });

  it('starts social account linking without exposing Better Auth directly', async () => {
    const result = {
      redirect: false,
      url: 'https://identity.example.com/authorize',
    };
    const { authService, resolver } = createResolver({
      linkSocialAccount: vi.fn(async () => result),
    });
    const input = {
      callbackURL: 'https://app.example.com/user/security',
      provider: 'oidc',
      scopes: ['openid'],
    };

    await expect(resolver.authLinkSocialAccount(input)).resolves.toBe(result);
    expect(authService.linkSocialAccount).toHaveBeenCalledWith({
      ...input,
      disableRedirect: true,
    });
  });

  it('updates the user through AuthService', async () => {
    const { authService, resolver } = createResolver({
      updateUser: vi.fn(async () => true),
    });

    await expect(resolver.authUpdateUser({ name: 'Renamed' })).resolves.toBe(
      true,
    );
    expect(authService.updateUser).toHaveBeenCalledWith({ name: 'Renamed' });
  });

  it('changes the password through AuthService', async () => {
    const result = { token: 'replacement-token' };
    const { authService, resolver } = createResolver({
      changePassword: vi.fn(async () => result),
    });
    const input = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      revokeOtherSessions: true,
    };

    await expect(resolver.authChangePassword(input)).resolves.toBe(result);
    expect(authService.changePassword).toHaveBeenCalledWith(input);
  });

  it('starts an email change through AuthService', async () => {
    const { authService, resolver } = createResolver({
      changeEmail: vi.fn(async () => true),
    });
    const input = {
      callbackURL: 'https://app.example.com/user?emailChanged=true',
      newEmail: 'next@example.com',
    };

    await expect(resolver.authChangeEmail(input)).resolves.toBe(true);
    expect(authService.changeEmail).toHaveBeenCalledWith(input);
  });

  it('deletes the current user through AuthService', async () => {
    const result = { message: 'User deleted', success: true };
    const { authService, resolver } = createResolver({
      deleteUser: vi.fn(async () => result),
    });

    await expect(
      resolver.authDeleteUser({ password: 'password' }),
    ).resolves.toBe(result);
    expect(authService.deleteUser).toHaveBeenCalledWith({
      password: 'password',
    });
  });

  it('lists sessions and marks the current session', async () => {
    const sessions = [
      {
        id: 'session-1',
        token: 'token-1',
      },
      {
        id: 'session-2',
        token: 'token-2',
      },
    ];
    const { resolver, sessionService } = createResolver(
      {},
      {
        listSessions: vi.fn(async () => sessions),
      },
    );

    await expect(resolver.authSessions(sessions[0] as never)).resolves.toEqual([
      expect.objectContaining({ current: true, id: 'session-1' }),
      expect.objectContaining({ current: false, id: 'session-2' }),
    ]);
    const result = await resolver.authSessions(sessions[0] as never);
    expect(result.every((session) => !('token' in session))).toBe(true);
    expect(sessionService.listSessions).toHaveBeenCalledWith();
  });

  it('delegates session revocation operations', async () => {
    const { resolver, sessionService } = createResolver(
      {},
      {
        revokeOtherSessions: vi.fn(async () => true),
        revokeSession: vi.fn(async () => true),
        revokeSessions: vi.fn(async () => true),
      },
    );
    await expect(resolver.authRevokeSession('session-2')).resolves.toBe(true);
    await expect(resolver.authRevokeOtherSessions()).resolves.toBe(true);
    await expect(resolver.authRevokeSessions()).resolves.toBe(true);
    expect(sessionService.revokeSession).toHaveBeenCalledWith('session-2');
    expect(sessionService.revokeOtherSessions).toHaveBeenCalledWith();
    expect(sessionService.revokeSessions).toHaveBeenCalledWith();
  });

  it('rejects an empty provider account selector', async () => {
    const { resolver } = createResolver();

    await expect(resolver.authAccessToken({})).rejects.toThrow(
      'Either accountId or useAccountCookie',
    );
  });
});

function createResolver(
  overrides: Record<string, unknown> = {},
  sessionOverrides: Record<string, unknown> = {},
) {
  const authService = {
    ...overrides,
  } as unknown as Mocked<AuthService>;
  const sessionService = {
    ...sessionOverrides,
  } as unknown as Mocked<SessionService>;

  return {
    authService,
    resolver: new AuthResolver(authService, sessionService),
    sessionService,
  };
}
