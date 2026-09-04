import type { AuthService, SessionService } from '@nest-boot/auth';
import type { Response } from 'express';
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

  it('signs in through AuthService and forwards session cookies', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session=value; Path=/; HttpOnly');
    const result = {
      redirect: false,
      token: 'session-token',
      url: null,
      user: { id: 'user-1' },
    };
    const { authService, resolver } = createResolver({
      signIn: vi.fn(async () => ({ headers, response: result })),
    });
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authSignIn(
        { email: 'alice@example.com', password: 'password' },
        response,
      ),
    ).resolves.toBe(result);
    expect(authService.signIn).toHaveBeenCalledWith(
      { email: 'alice@example.com', password: 'password' },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session=value; Path=/; HttpOnly',
    ]);
  });

  it('starts social sign-in through AuthService and forwards state cookies', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'oauth-state=value; Path=/; HttpOnly');
    const result = {
      redirect: true,
      token: null,
      url: 'https://identity.example.com/authorize',
      user: null,
    };
    const { authService, resolver } = createResolver({
      signInSocial: vi.fn(async () => ({ headers, response: result })),
    });
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      callbackURL: 'https://app.example.com',
      provider: 'company',
    };

    await expect(resolver.authSignInSocial(input, response)).resolves.toBe(
      result,
    );
    expect(authService.signInSocial).toHaveBeenCalledWith(
      { ...input, disableRedirect: true },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'oauth-state=value; Path=/; HttpOnly',
    ]);
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
    const headers = new Headers();
    headers.append('set-cookie', 'oauth-state=value; Path=/; HttpOnly');
    const result = {
      redirect: false,
      url: 'https://identity.example.com/authorize',
    };
    const { authService, resolver } = createResolver({
      linkSocialAccount: vi.fn(async () => ({ headers, response: result })),
    });
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      callbackURL: 'https://app.example.com/user/security',
      provider: 'oidc',
      scopes: ['openid'],
    };

    await expect(resolver.authLinkSocialAccount(input, response)).resolves.toBe(
      result,
    );
    expect(authService.linkSocialAccount).toHaveBeenCalledWith(
      {
        ...input,
        disableRedirect: true,
      },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'oauth-state=value; Path=/; HttpOnly',
    ]);
  });

  it('updates the user and forwards refreshed session cookies', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session_data=updated; Path=/; HttpOnly');
    const { authService, resolver } = createResolver({
      updateUser: vi.fn(async () => ({ headers, response: true })),
    });
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authUpdateUser({ name: 'Renamed' }, response),
    ).resolves.toBe(true);
    expect(authService.updateUser).toHaveBeenCalledWith(
      { name: 'Renamed' },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session_data=updated; Path=/; HttpOnly',
    ]);
  });

  it('changes the password and forwards the replacement session cookie', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session=replacement; Path=/; HttpOnly');
    const result = { token: 'replacement-token' };
    const { authService, resolver } = createResolver({
      changePassword: vi.fn(async () => ({ headers, response: result })),
    });
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      revokeOtherSessions: true,
    };

    await expect(resolver.authChangePassword(input, response)).resolves.toBe(
      result,
    );
    expect(authService.changePassword).toHaveBeenCalledWith(input, {
      returnHeaders: true,
    });
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session=replacement; Path=/; HttpOnly',
    ]);
  });

  it('starts an email change and forwards refreshed session cookies', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session_data=updated; Path=/; HttpOnly');
    const { authService, resolver } = createResolver({
      changeEmail: vi.fn(async () => ({ headers, response: true })),
    });
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      callbackURL: 'https://app.example.com/user?emailChanged=true',
      newEmail: 'next@example.com',
    };

    await expect(resolver.authChangeEmail(input, response)).resolves.toBe(true);
    expect(authService.changeEmail).toHaveBeenCalledWith(input, {
      returnHeaders: true,
    });
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session_data=updated; Path=/; HttpOnly',
    ]);
  });

  it('deletes the current user and forwards cookie removal headers', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session=; Max-Age=0; Path=/; HttpOnly');
    const result = { message: 'User deleted', success: true };
    const { authService, resolver } = createResolver({
      deleteUser: vi.fn(async () => ({ headers, response: result })),
    });
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authDeleteUser(response, { password: 'password' }),
    ).resolves.toBe(result);
    expect(authService.deleteUser).toHaveBeenCalledWith(
      { password: 'password' },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session=; Max-Age=0; Path=/; HttpOnly',
    ]);
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
    await expect(resolver.authRevokeSession('token-2')).resolves.toBe(true);
    await expect(resolver.authRevokeOtherSessions()).resolves.toBe(true);
    await expect(resolver.authRevokeSessions()).resolves.toBe(true);
    expect(sessionService.revokeSession).toHaveBeenCalledWith('token-2');
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
