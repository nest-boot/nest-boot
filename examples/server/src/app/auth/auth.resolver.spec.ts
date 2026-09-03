import type { AuthService, SessionService } from '@nest-boot/auth';
import type { Request, Response } from 'express';
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
    const request = { headers: { cookie: 'existing=value' } } as Request;
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authSignIn(
        { email: 'alice@example.com', password: 'password' },
        request,
        response,
      ),
    ).resolves.toBe(result);
    expect(authService.signIn).toHaveBeenCalledWith(
      expect.objectContaining({}),
      { email: 'alice@example.com', password: 'password' },
      { returnHeaders: true },
    );
    expect(response.append).toHaveBeenCalledWith('set-cookie', [
      'session=value; Path=/; HttpOnly',
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
      resolver.authAccessToken({ accountId: 'account-1' }, {
        headers: {},
      } as Request),
    ).resolves.toBe(token);
    expect(authService.getAccessToken).toHaveBeenCalledWith(
      expect.any(Headers),
      { accountId: 'account-1' },
    );
  });

  it('updates the user and forwards refreshed session cookies', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session_data=updated; Path=/; HttpOnly');
    const { authService, resolver } = createResolver({
      updateUser: vi.fn(async () => ({ headers, response: true })),
    });
    const request = { headers: { cookie: 'session=value' } } as Request;
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authUpdateUser({ name: 'Renamed' }, request, response),
    ).resolves.toBe(true);
    expect(authService.updateUser).toHaveBeenCalledWith(
      expect.any(Headers),
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
    const request = { headers: { cookie: 'session=old' } } as Request;
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      revokeOtherSessions: true,
    };

    await expect(
      resolver.authChangePassword(input, request, response),
    ).resolves.toBe(result);
    expect(authService.changePassword).toHaveBeenCalledWith(
      expect.any(Headers),
      input,
      { returnHeaders: true },
    );
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
    const request = { headers: { cookie: 'session=value' } } as Request;
    const response = { append: vi.fn() } as unknown as Response;
    const input = {
      callbackURL: 'https://app.example.com/user?emailChanged=true',
      newEmail: 'next@example.com',
    };

    await expect(
      resolver.authChangeEmail(input, request, response),
    ).resolves.toBe(true);
    expect(authService.changeEmail).toHaveBeenCalledWith(
      expect.any(Headers),
      input,
      { returnHeaders: true },
    );
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
    const request = { headers: { cookie: 'session=value' } } as Request;
    const response = { append: vi.fn() } as unknown as Response;

    await expect(
      resolver.authDeleteUser(request, response, { password: 'password' }),
    ).resolves.toBe(result);
    expect(authService.deleteUser).toHaveBeenCalledWith(
      expect.any(Headers),
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

    await expect(
      resolver.authSessions(
        { headers: { cookie: 'session=value' } } as Request,
        sessions[0] as never,
      ),
    ).resolves.toEqual([
      expect.objectContaining({ current: true, id: 'session-1' }),
      expect.objectContaining({ current: false, id: 'session-2' }),
    ]);
    expect(sessionService.listSessions).toHaveBeenCalledWith(
      expect.any(Headers),
    );
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
    const request = { headers: { cookie: 'session=value' } } as Request;

    await expect(resolver.authRevokeSession('token-2', request)).resolves.toBe(
      true,
    );
    await expect(resolver.authRevokeOtherSessions(request)).resolves.toBe(true);
    await expect(resolver.authRevokeSessions(request)).resolves.toBe(true);
    expect(sessionService.revokeSession).toHaveBeenCalledWith(
      expect.any(Headers),
      'token-2',
    );
    expect(sessionService.revokeOtherSessions).toHaveBeenCalledWith(
      expect.any(Headers),
    );
    expect(sessionService.revokeSessions).toHaveBeenCalledWith(
      expect.any(Headers),
    );
  });

  it('rejects an empty provider account selector', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.authAccessToken({}, { headers: {} } as Request),
    ).rejects.toThrow('Either accountId or useAccountCookie');
  });
});

function createResolver(
  overrides: Partial<AuthService> = {},
  sessionOverrides: Partial<SessionService> = {},
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
