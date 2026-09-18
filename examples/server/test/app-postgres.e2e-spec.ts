import {
  type ChildProcessWithoutNullStreams,
  execFile,
  spawn,
} from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  EntitySchema,
  MikroORM,
  PostgreSqlDriver,
} from '@mikro-orm/postgresql';
import request from 'supertest';

import { createContextualAuthService } from '../../../packages/auth/dist/infrastructure/create-contextual-auth-service.js';

interface DbProbe {
  id: number;
}

const DbProbeSchema = new EntitySchema<DbProbe>({
  name: 'ExampleServerE2eDbProbe',
  tableName: 'example_server_e2e_db_probe',
  properties: {
    id: {
      type: 'number',
      primary: true,
    },
  },
});

const adminDatabaseUrl =
  process.env.SERVER_E2E_DATABASE_URL ??
  'postgresql://postgres:secret@localhost:35432/postgres';
const mailpitUrl =
  process.env.SERVER_E2E_MAILPIT_URL ?? 'http://127.0.0.1:38025';
const databaseName = `nest_boot_example_e2e_${process.pid}_${Date.now()}`;
const databaseUrl = databaseUrlFor(databaseName);
const execFileAsync = promisify(execFile);
const envKeys = [
  'NODE_ENV',
  'DB_URL',
  'DATABASE_URL',
  'APP_URL',
  'AUTH_URL',
  'APP_SECRET',
  'AUTH_SECRET',
  'AUTH_GITHUB_ENABLED',
  'AUTH_GITHUB_CLIENT_ID',
  'AUTH_GITHUB_CLIENT_SECRET',
  'AUTH_OIDC_ENABLED',
  'AUTH_OIDC_CLIENT_ID',
  'AUTH_OIDC_CLIENT_SECRET',
  'AUTH_OIDC_DISCOVERY_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'PORT',
] as const;
const oldEnv = new Map<string, string | undefined>();
let uniqueCounter = 0;

interface AuthenticatedUser {
  cookies: string[];
  email: string;
  password: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface WorkspaceFixture {
  id: string;
  name: string;
}

type AdminOrm = Awaited<ReturnType<typeof adminOrm>>;

interface MigrationInstance {
  getQueries(): string[];
  up(): Promise<void> | void;
}

type MigrationConstructor = new () => MigrationInstance;

describe('Server application PostgreSQL integration (e2e)', () => {
  let migrationOrm: AdminOrm;
  let serverProcess: ChildProcessWithoutNullStreams;
  let serverOutput = '';
  let baseUrl: string;

  beforeAll(async () => {
    setTestEnv();
    await createDatabase();
    migrationOrm = await adminOrm(databaseUrl);
    await applyMigrations(migrationOrm);

    await execFileAsync('pnpm', ['build'], {
      cwd: process.cwd(),
      env: process.env,
    });

    const port = await getFreePort();
    process.env.PORT = String(port);
    baseUrl = `http://127.0.0.1:${port}`;
    process.env.AUTH_URL = baseUrl;
    serverProcess = spawn(
      process.execPath,
      ['--trace-uncaught', 'dist/main.js'],
      {
        cwd: process.cwd(),
        env: createServerEnv(),
      },
    );
    serverProcess.stdout.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });
    serverProcess.stderr.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });

    await waitForServer(baseUrl, serverProcess, () => serverOutput);
  }, 60_000);

  afterAll(async () => {
    if (serverProcess) {
      await stopServer(serverProcess);
    }

    if (migrationOrm) {
      await migrationOrm.close(true);
    }

    await dropDatabase();
    restoreEnv();
  }, 30_000);

  it('exposes only social providers enabled by the server', async () => {
    const result = await gql(/* GraphQL */ `
      query {
        socialProviders {
          id
          name
        }
      }
    `);

    expectNoGraphQLErrors(result);
    expect(result.body.data.socialProviders).toEqual([
      { id: 'github', name: 'GitHub' },
    ]);

    const socialSignIn = await gql(
      /* GraphQL */ `
        mutation SignInSocial($input: AuthSignInSocialInput!) {
          signInSocial(input: $input) {
            redirect
            url
            token
            user {
              id
            }
          }
        }
      `,
      {
        variables: {
          input: {
            provider: 'github',
            callbackURL: 'http://127.0.0.1/user/workspaces',
            errorCallbackURL: 'http://127.0.0.1/auth/login',
          },
        },
      },
    );

    expectNoGraphQLErrors(socialSignIn);
    expect(socialSignIn.body.data.signInSocial).toMatchObject({
      redirect: false,
      token: null,
      user: null,
    });
    expect(new URL(socialSignIn.body.data.signInSocial.url).origin).toBe(
      'https://github.com',
    );
    expect(collectRawSetCookies(socialSignIn).length).toBeGreaterThan(0);
  });

  it('authenticates users with real email and password sessions', async () => {
    const email = uniqueEmail('alice');
    const password = 'correct-horse-battery-staple';

    const registered = await signUpWithEmail({
      name: 'Alice',
      email,
      password,
    });

    expect(registered.status).toBe(200);
    expect(registered.body.user).toMatchObject({
      name: 'Alice',
      email,
    });
    expect(collectSetCookies(registered)).toEqual([]);

    const [credentialAccount] = await migrationOrm.em
      .getConnection()
      .execute<
        { account_id: string; issuer: string }[]
      >('select account_id, issuer from account where user_id = ?', [registered.body.user.id]);
    expect(credentialAccount).toEqual({
      account_id: String(registered.body.user.id),
      issuer: 'local:credential',
    });

    const rejectedLogin = await signInWithEmail({
      email,
      password: 'wrong-password',
    });

    expect(rejectedLogin.status).toBe(401);

    const rejectedUnverifiedLogin = await signInWithEmail({
      email,
      password,
    });

    expect(rejectedUnverifiedLogin.status).toBe(403);

    await verifyEmail(email);

    const loggedIn = await signInWithEmail({
      email,
      password,
    });
    const sessionCookies = collectSetCookies(loggedIn);

    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user).toMatchObject({
      name: 'Alice',
      email,
    });
    expect(sessionCookies.length).toBeGreaterThan(0);

    const rejectedCurrentUser = await gql(/* GraphQL */ `
      query {
        currentUser {
          id
        }
      }
    `);

    expectGraphQLError(rejectedCurrentUser);

    const currentUser = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
            name
            email
          }
        }
      `,
      { cookies: sessionCookies },
    );

    expectNoGraphQLErrors(currentUser);
    expect(currentUser.body.data.currentUser).toMatchObject({
      name: 'Alice',
      email,
    });

    const passwordResetRequested = await request(baseUrl)
      .post('/api/auth/request-password-reset')
      .send({
        email,
        redirectTo: `${baseUrl}/auth/reset-password`,
      });

    expect(passwordResetRequested.status).toBe(200);
    const passwordResetUrl = new URL(
      await waitForEmailUrl(email, 'Reset your password'),
    );
    const passwordResetToken = passwordResetUrl.pathname.split('/').at(-1);

    expect(passwordResetToken).toBeTypeOf('string');

    const passwordResetCallback = await request(baseUrl).get(
      `${passwordResetUrl.pathname}${passwordResetUrl.search}`,
    );

    expect(passwordResetCallback.status).toBe(302);
    expect(passwordResetCallback.headers.location).toContain(
      '/auth/reset-password?token=',
    );

    const newPassword = 'updated-correct-horse-battery-staple';
    const passwordReset = await request(baseUrl)
      .post('/api/auth/reset-password')
      .send({
        newPassword,
        token: passwordResetToken,
      });

    expect(passwordReset.status).toBe(200);
    expect(passwordReset.body).toEqual({ status: true });
    expect((await signInWithEmail({ email, password })).status).toBe(401);
    expect(
      (await signInWithEmail({ email, password: newPassword })).status,
    ).toBe(200);
  });

  it('rejects registration user relations before creating an account', async () => {
    const email = uniqueEmail('graphql-signup-relations');
    const response = await gql(
      'mutation($input: AuthSignUpInput!) { signUp(input: $input) { user { accounts { totalCount } } } }',
      {
        variables: {
          input: {
            email,
            name: 'Rejected Selection',
            password: 'correct-horse-battery-staple',
          },
        },
      },
    );
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            'Cannot query field "user" on type "SignUpPayload"',
          ),
        }),
      ]),
    );
    expect(
      await migrationOrm.em
        .getConnection()
        .execute('select id from "user" where email = ?', [email]),
    ).toEqual([]);
  });

  it('supports email authentication through GraphQL with cookie sessions', async () => {
    const email = uniqueEmail('graphql-auth');
    const password = 'correct-horse-battery-staple';
    const registered = await gql(
      /* GraphQL */ `
        mutation SignUp($input: AuthSignUpInput!) {
          signUp(input: $input) {
            id
            token
          }
        }
      `,
      {
        variables: {
          input: { email, name: 'GraphQL User', password },
        },
      },
    );

    expectNoGraphQLErrors(registered);
    expect(registered.body.data.signUp).toEqual({
      id: expect.any(String),
      token: null,
    });
    const registeredUsers = await migrationOrm.em
      .getConnection()
      .execute('select id, name, email from "user" where email = ?', [email]);
    expect(registeredUsers).toEqual([
      { id: registered.body.data.signUp.id, name: 'GraphQL User', email },
    ]);
    const unauthenticated = await gql('query { currentUser { id } }', {
      cookies: collectSetCookies(registered),
    });
    expect(unauthenticated.body.errors).toBeDefined();
    await verifyEmail(email);

    const loggedIn = await gql(
      /* GraphQL */ `
        mutation SignIn($input: AuthSignInInput!) {
          signIn(input: $input) {
            token
            user {
              id
              email
              roles
              accounts(first: 20) {
                edges {
                  node {
                    id
                    providerId
                    scopes
                  }
                }
              }
              sessions(first: 1) {
                edges {
                  node {
                    id
                    current
                  }
                }
              }
              workspaces(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { input: { email, password, rememberMe: false } } },
    );
    const cookies = collectSetCookies(loggedIn);
    const sessionCookie = collectRawSetCookies(loggedIn).find((cookie) =>
      cookie.includes('session_token='),
    );

    expectNoGraphQLErrors(loggedIn);
    expect(loggedIn.body.data.signIn.user.email).toBe(email);
    expect(loggedIn.body.data.signIn.user.roles).toEqual(['USER']);
    expect(loggedIn.body.data.signIn.user.sessions.edges[0].node.current).toBe(
      true,
    );
    expect(
      loggedIn.body.data.signIn.user.accounts.edges[0].node.providerId,
    ).toBe('credential');
    expect(cookies.length).toBeGreaterThan(0);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/(?:max-age|expires)=/iu);

    const otherLogin = await signInWithEmail({ email, password });
    const otherCookies = collectSetCookies(otherLogin);
    const listedSessions = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            sessions(first: 100) {
              edges {
                node {
                  id
                  current
                  ipAddress
                  userAgent
                  createdAt
                  expiresAt
                }
              }
            }
          }
        }
      `,
      { cookies },
    );

    expectNoGraphQLErrors(listedSessions);
    expect(
      listedSessions.body.data.currentUser.sessions.edges.map(
        ({ node }: any) => node,
      ),
    ).toHaveLength(2);
    expect(
      listedSessions.body.data.currentUser.sessions.edges
        .map(({ node }: any) => node)
        .filter((session: { current: boolean }) => session.current),
    ).toHaveLength(1);
    const otherSession = listedSessions.body.data.currentUser.sessions.edges
      .map(({ node }: any) => node)
      .find((session: { current: boolean }) => !session.current);
    expect(otherSession?.id).toBeTypeOf('string');
    expect(otherSession).not.toHaveProperty('token');

    const revokedSession = await gql(
      /* GraphQL */ `
        mutation RevokeSession($sessionId: ID!) {
          revokeCurrentUserSession(id: $sessionId)
        }
      `,
      {
        cookies,
        variables: { sessionId: otherSession.id },
      },
    );

    expectNoGraphQLErrors(revokedSession);
    expect(revokedSession.body.data.revokeCurrentUserSession).toBe(true);
    expectGraphQLError(
      await gql(
        /* GraphQL */ `
          query {
            currentUser {
              id
            }
          }
        `,
        { cookies: otherCookies },
      ),
    );

    const changedPassword = 'graphql-changed-password';
    const passwordChanged = await gql(
      /* GraphQL */ `
        mutation ChangePassword($input: AuthChangePasswordInput!) {
          changeCurrentUserPassword(input: $input) {
            token
          }
        }
      `,
      {
        cookies,
        variables: {
          input: {
            currentPassword: password,
            newPassword: changedPassword,
            revokeOtherSessions: true,
          },
        },
      },
    );
    const replacementCookies = collectSetCookies(passwordChanged);

    expectNoGraphQLErrors(passwordChanged);
    expect(
      passwordChanged.body.data.changeCurrentUserPassword.token,
    ).toBeTypeOf('string');
    expect(replacementCookies.length).toBeGreaterThan(0);
    expect((await signInWithEmail({ email, password })).status).toBe(401);
    expect(
      (await signInWithEmail({ email, password: changedPassword })).status,
    ).toBe(200);

    const passwordResetRequested = await gql(
      /* GraphQL */ `
        mutation RequestPasswordReset($input: AuthRequestPasswordResetInput!) {
          requestPasswordReset(input: $input) {
            status
          }
        }
      `,
      {
        variables: {
          input: {
            email,
            redirectTo: `${baseUrl}/auth/reset-password`,
          },
        },
      },
    );

    expectNoGraphQLErrors(passwordResetRequested);
    expect(passwordResetRequested.body.data.requestPasswordReset.status).toBe(
      true,
    );

    const passwordResetUrl = new URL(
      await waitForEmailUrl(email, 'Reset your password'),
    );
    const passwordResetCallback = await request(baseUrl).get(
      `${passwordResetUrl.pathname}${passwordResetUrl.search}`,
    );
    const passwordResetLocation = new URL(
      passwordResetCallback.headers.location ?? '',
      baseUrl,
    );
    const passwordResetToken = passwordResetLocation.searchParams.get('token');

    expect(passwordResetCallback.status).toBe(302);
    expect(passwordResetToken).toBeTypeOf('string');
    if (!passwordResetToken) throw new Error('Password reset token is missing');

    const resetPassword = 'graphql-reset-password';
    const passwordReset = await gql(
      /* GraphQL */ `
        mutation ResetPassword($input: AuthResetPasswordInput!) {
          resetPassword(input: $input)
        }
      `,
      {
        variables: {
          input: {
            newPassword: resetPassword,
            token: passwordResetToken,
          },
        },
      },
    );

    expectNoGraphQLErrors(passwordReset);
    expect(passwordReset.body.data.resetPassword).toBe(true);
    expect(
      (await signInWithEmail({ email, password: changedPassword })).status,
    ).toBe(401);
    const resetPasswordLogin = await signInWithEmail({
      email,
      password: resetPassword,
    });
    expect(resetPasswordLogin.status).toBe(200);

    const signedOut = await gql(
      /* GraphQL */ `
        mutation {
          signOut
        }
      `,
      { cookies: collectSetCookies(resetPasswordLogin) },
    );

    expectNoGraphQLErrors(signedOut);
    expect(signedOut.body.data.signOut).toBe(true);
    expect(collectSetCookies(signedOut).length).toBeGreaterThan(0);
  });

  it('changes a verified email through GraphQL after verifying the new address', async () => {
    const email = uniqueEmail('graphql-change-email');
    const newEmail = uniqueEmail('graphql-changed-email');
    const password = 'correct-horse-battery-staple';
    const registered = await signUpWithEmail({
      email,
      name: 'Email Change User',
      password,
    });

    expect(registered.status).toBe(200);
    await verifyEmail(email);

    const loggedIn = await signInWithEmail({ email, password });
    const cookies = collectSetCookies(loggedIn);
    expect(loggedIn.status).toBe(200);

    const changeRequested = await gql(
      /* GraphQL */ `
        mutation ChangeEmail($input: AuthChangeEmailInput!) {
          changeCurrentUserEmail(input: $input)
        }
      `,
      {
        cookies,
        variables: {
          input: {
            callbackURL: `${baseUrl}/user?emailChangeCallback=true&newEmail=${encodeURIComponent(newEmail)}`,
            newEmail,
          },
        },
      },
    );

    expectNoGraphQLErrors(changeRequested);
    expect(changeRequested.body.data.changeCurrentUserEmail).toBe(true);

    const confirmationUrl = new URL(
      await waitForEmailUrl(email, 'Confirm your email change'),
    );
    const confirmed = await request(baseUrl).get(
      `${confirmationUrl.pathname}${confirmationUrl.search}`,
    );

    expect(confirmed.status).toBe(302);
    expect(confirmed.headers.location).toContain('emailChangeCallback=true');

    const verificationUrl = new URL(
      await waitForEmailUrl(newEmail, 'Verify your email address'),
    );
    const verified = await request(baseUrl).get(
      `${verificationUrl.pathname}${verificationUrl.search}`,
    );
    const verificationCookies = collectSetCookies(verified);

    expect(verified.status).toBe(302);
    expect(verified.headers.location).toContain('emailChangeCallback=true');
    expect(verificationCookies.length).toBeGreaterThan(0);

    const currentUser = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            email
          }
        }
      `,
      { cookies: verificationCookies },
    );

    expectNoGraphQLErrors(currentUser);
    expect(currentUser.body.data.currentUser).toEqual({ email: newEmail });
    const [updatedUser] = await migrationOrm.em
      .getConnection()
      .execute<
        { email: string; email_verified: boolean }[]
      >('select email, email_verified from "user" where email = ?', [newEmail]);
    expect(updatedUser).toEqual({ email: newEmail, email_verified: true });
    expect((await signInWithEmail({ email, password })).status).toBe(401);
    expect((await signInWithEmail({ email: newEmail, password })).status).toBe(
      200,
    );
  });

  it('lists configured user roles and assigns them through GraphQL', async () => {
    const administrator = await createAuthenticatedUser('Role Administrator');
    const target = await createAuthenticatedUser('Role Target');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        administrator.user.id,
      ]);

    const catalog = await gql(
      /* GraphQL */ `
        query UserRoleCatalog {
          userRoles {
            role
            grantable
          }
          userPermissions {
            permission
            grantable
          }
        }
      `,
      { cookies: administrator.cookies },
    );

    expectNoGraphQLErrors(catalog);
    expect(catalog.body.data.userRoles).toEqual(
      expect.arrayContaining([
        { role: 'ADMIN', grantable: true },
        { role: 'USER', grantable: true },
      ]),
    );
    expect(catalog.body.data.userPermissions).toContainEqual({
      permission: 'USER__SET_ROLE',
      grantable: true,
    });

    await migrationOrm.em
      .getConnection()
      .execute(
        `update "user" set roles = array['user'], permissions = array['user:set-role'] where id = ?`,
        [administrator.user.id],
      );
    const limitedCatalog = await gql(
      `query { userRoles { role grantable } userPermissions { permission grantable } }`,
      { cookies: administrator.cookies },
    );
    expectNoGraphQLErrors(limitedCatalog);
    expect(limitedCatalog.body.data.userRoles).toEqual(
      expect.arrayContaining([
        { role: 'ADMIN', grantable: false },
        { role: 'USER', grantable: true },
      ]),
    );
    expect(limitedCatalog.body.data.userPermissions).toContainEqual({
      permission: 'USER__DELETE',
      grantable: false,
    });
    await migrationOrm.em
      .getConnection()
      .execute(
        `update "user" set roles = array['admin'], permissions = '{}' where id = ?`,
        [administrator.user.id],
      );

    const assigned = await gql(
      /* GraphQL */ `
        mutation SetUserRoles($id: ID!, $input: SetUserRolesInput!) {
          setUserRoles(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: {
          id: target.user.id,
          input: { roles: ['ADMIN'] },
        },
      },
    );

    expectNoGraphQLErrors(assigned);
    expect(assigned.body.data.setUserRoles).toEqual({
      id: target.user.id,
    });
    expect(
      await migrationOrm.em
        .getConnection()
        .execute('select roles from "user" where id = ?', [target.user.id]),
    ).toEqual([{ roles: ['admin'] }]);
  });

  it('returns ID-only payloads for administrative user writes and rejects relation selections before persistence', async () => {
    const administrator = await createAuthenticatedUser(
      'Payload Administrator',
    );
    const connection = migrationOrm.em.getConnection();
    await connection.execute(
      `update "user" set roles = array['admin'] where id = ?`,
      [administrator.user.id],
    );
    const email = uniqueEmail('admin-payload');
    const create = (selection: string) =>
      gql(
        `mutation($input: CreateUserInput!) { createUser(input: $input) { ${selection} } }`,
        {
          cookies: administrator.cookies,
          variables: {
            input: {
              email,
              name: 'Created',
              password: 'correct-horse-battery-staple',
            },
          },
        },
      );
    const rejected = await create('accounts { totalCount }');
    expect(rejected.body.errors[0].message).toContain(
      'Cannot query field "accounts"',
    );
    expect(
      await connection.execute('select id from "user" where email = ?', [
        email,
      ]),
    ).toEqual([]);
    const created = await create('id');
    expectNoGraphQLErrors(created);
    const id = created.body.data.createUser.id as string;
    expect(created.body.data.createUser).toEqual({ id: expect.any(String) });
    const readUser = () =>
      connection.execute(
        'select name, roles, permissions, banned from "user" where id = ?',
        [id],
      );
    for (const [operation, inputType, input, expected] of [
      [
        'updateUser',
        'UpdateUserInput!',
        { name: 'Updated' },
        { name: 'Updated' },
      ],
      [
        'setUserRoles',
        'SetUserRolesInput!',
        { roles: ['USER'] },
        { roles: ['user'] },
      ],
      [
        'setUserPermissions',
        'SetUserPermissionsInput!',
        { permissions: ['USER__GET'] },
        { permissions: ['user:get'] },
      ],
      ['banUser', 'BanUserInput', { reason: 'Test ban' }, { banned: true }],
      ['unbanUser', null, null, { banned: false }],
    ] as const) {
      const mutate = (selection: string) =>
        gql(
          `mutation($id: ID!${inputType ? `, $input: ${inputType}` : ''}) { ${operation}(id: $id${inputType ? ', input: $input' : ''}) { ${selection} } }`,
          {
            cookies: administrator.cookies,
            variables: { id, ...(inputType ? { input } : {}) },
          },
        );
      const before = await readUser();
      const invalid = await mutate('accounts { totalCount }');
      expect(invalid.body.errors[0].message).toContain(
        'Cannot query field "accounts"',
      );
      expect(await readUser()).toEqual(before);
      const updated = await mutate('id');
      expectNoGraphQLErrors(updated);
      expect(updated.body.data[operation]).toEqual({ id });
      expect((await readUser())[0]).toMatchObject(expected);
    }
  });

  it.each(['session', 'apiKey'] as const)(
    'caps user grants for a restricted %s',
    async (authentication) => {
      const issuer = await createAuthenticatedUser('Restricted Grant Issuer');
      const permissions = ['user:get', 'user:create', 'user:set-role'];
      const connection = migrationOrm.em.getConnection();
      await connection.execute(
        'update "user" set roles = ?, permissions = ? where id = ?',
        [
          authentication === 'apiKey' ? '{admin}' : '{}',
          `{${permissions.join(',')}}`,
          issuer.user.id,
        ],
      );
      const credentials =
        authentication === 'session'
          ? { cookies: issuer.cookies }
          : {
              bearerToken: (
                await createUserApiKey(issuer, {
                  name: 'Limited administration',
                  permissions: ['USER__GET', 'USER__CREATE', 'USER__SET_ROLE'],
                })
              ).apiKey,
            };
      const grant = (grantedPermissions: string[]) =>
        gql(
          `mutation ($id: ID!, $input: SetUserPermissionsInput!) {
      setUserPermissions(id: $id, input: $input) { id }
    }`,
          {
            ...credentials,
            variables: {
              id: issuer.user.id,
              input: { permissions: grantedPermissions },
            },
          },
        );
      for (const [permission, enumName] of [
        ['user:delete', 'USER__DELETE'],
        ['user:impersonate-admins', 'USER__IMPERSONATE_ADMINS'],
      ]) {
        const denied = await grant([enumName]);
        expect(denied.body.errors).toEqual([
          expect.objectContaining({
            message: `User permissions exceed issuer permissions: ${permission}`,
          }),
        ]);
      }
      const rolesDenied = await gql(
        `mutation ($id: ID!, $input: SetUserRolesInput!) {
      setUserRoles(id: $id, input: $input) { id }
    }`,
        {
          ...credentials,
          variables: { id: issuer.user.id, input: { roles: ['ADMIN'] } },
        },
      );
      expect(rolesDenied.body.errors[0].message).toContain(
        'User permissions exceed issuer permissions',
      );
      const email = uniqueEmail('Denied Grant');
      const createDenied = await gql(
        `mutation ($input: CreateUserInput!) { createUser(input: $input) { id } }`,
        {
          ...credentials,
          variables: {
            input: {
              name: 'Denied Grant',
              email,
              password: issuer.password,
              roles: ['ADMIN'],
            },
          },
        },
      );
      expect(createDenied.body.errors[0].message).toContain(
        'User permissions exceed issuer permissions',
      );
      expect(
        await connection.execute('select id from "user" where email = ?', [
          email,
        ]),
      ).toEqual([]);
      const [unchanged] = await connection.execute(
        'select roles, permissions from "user" where id = ?',
        [issuer.user.id],
      );
      expect(unchanged).toEqual({
        roles: authentication === 'apiKey' ? ['admin'] : [],
        permissions,
      });
      expectNoGraphQLErrors(await grant(['USER__GET']));
    },
  );

  it.each(['self', 'administrator'] as const)(
    'preserves ownerless workspaces and deletes auth records through %s deletion',
    async (mode) => {
      const administrator = await createAuthenticatedUser(
        'Deletion Administrator',
      );
      const target = await createAuthenticatedUser('Deletion Target');
      await migrationOrm.em
        .getConnection()
        .execute(`update "user" set roles = array['admin'] where id = ?`, [
          administrator.user.id,
        ]);

      const workspace = await createWorkspace(target, 'Deletion Workspace');
      await createUserApiKey(target, {
        name: 'Deletion target key',
        permissions: ['WORKSPACE__UPDATE'],
      });

      const connection = migrationOrm.em.getConnection();
      await connection.execute(
        "insert into member (workspace_id, user_id, name, roles) values (?, ?, ?, array['member'])",
        [workspace.id, administrator.user.id, 'Retained member'],
      );
      await createWorkspaceApiKey(target, workspace.id, {
        name: 'Retained workspace key',
        permissions: [],
      });
      const deleted = await gql(
        mode === 'self'
          ? /* GraphQL */ `
              mutation {
                deleteCurrentUser {
                  success
                }
              }
            `
          : /* GraphQL */ `
              mutation DeleteUser($id: ID!) {
                deleteUser(id: $id) {
                  __typename
                  id
                }
              }
            `,
        {
          cookies: mode === 'self' ? target.cookies : administrator.cookies,
          variables: { id: target.user.id },
        },
      );
      expectNoGraphQLErrors(deleted);
      if (mode === 'self') {
        expect(deleted.body.data.deleteCurrentUser.success).toBe(true);
      } else {
        expect(deleted.body.data.deleteUser).toEqual({
          __typename: 'DeleteUserPayload',
          id: target.user.id,
        });
      }
      const [retained] = await connection.execute(
        'select name, deleted_at from workspace where id = ?',
        [workspace.id],
      );
      expect(retained).toEqual({
        name: 'Deletion Workspace',
        deleted_at: null,
      });
      expect(
        await connection.execute(
          'select user_id::text, roles from member where workspace_id = ?',
          [workspace.id],
        ),
      ).toEqual([{ user_id: administrator.user.id, roles: ['member'] }]);
      expect(
        await connection.execute(
          'select id from workspace_api_key where workspace_id = ?',
          [workspace.id],
        ),
      ).toHaveLength(1);

      const [counts] = await migrationOrm.em.getConnection().execute<
        {
          accounts: number;
          api_keys: number;
          members: number;
          sessions: number;
          users: number;
        }[]
      >(
        /* SQL */ `
        select
          (select count(*)::int from "user" where id = ?) as users,
          (select count(*)::int from account where user_id = ?) as accounts,
          (select count(*)::int from session where user_id = ?) as sessions,
          (select count(*)::int from user_api_key where user_id = ?) as api_keys,
          (select count(*)::int from member where user_id = ? and workspace_id = ?) as members
      `,
        [
          target.user.id,
          target.user.id,
          target.user.id,
          target.user.id,
          target.user.id,
          workspace.id,
        ],
      );
      expect(counts).toEqual({
        accounts: 0,
        api_keys: 0,
        members: 0,
        sessions: 0,
        users: 0,
      });
    },
  );

  it('rejects permissions outside the configured owner catalogs', async () => {
    const administrator = await createAuthenticatedUser(
      'Permission Catalog Administrator',
    );
    const target = await createAuthenticatedUser('Permission Catalog Target');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        administrator.user.id,
      ]);

    const invalidUserPermission = await gql(
      /* GraphQL */ `
        mutation SetUserPermissions(
          $id: ID!
          $input: SetUserPermissionsInput!
        ) {
          setUserPermissions(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: {
          id: target.user.id,
          input: { permissions: ['WORKSPACE__UPDATE'] },
        },
      },
    );
    expectGraphQLError(invalidUserPermission);

    const workspace = await createWorkspace(
      administrator,
      'Permission Catalog Workspace',
    );
    const currentMember = await gql(
      /* GraphQL */ `
        query {
          currentMember {
            id
          }
        }
      `,
      {
        cookies: administrator.cookies,
        workspaceId: workspace.id,
      },
    );
    expectNoGraphQLErrors(currentMember);

    const invalidMemberPermission = await gql(
      /* GraphQL */ `
        mutation SetMemberPermissions(
          $id: ID!
          $input: SetMemberPermissionsInput!
        ) {
          setMemberPermissions(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: {
          id: currentMember.body.data.currentMember.id,
          input: { permissions: ['USER__GET'] },
        },
        workspaceId: workspace.id,
      },
    );
    expectGraphQLError(invalidMemberPermission);

    const invalidWorkspaceKey = await gql(
      /* GraphQL */ `
        mutation CreateApiKey($input: CreateWorkspaceApiKeyInput!) {
          createWorkspaceApiKey(input: $input) {
            apiKey
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: {
          input: {
            name: 'Invalid workspace key',
            permissions: ['USER__GET'],
          },
        },
        workspaceId: workspace.id,
      },
    );
    expectGraphQLError(invalidWorkspaceKey);

    const invalidUserKey = await gql(
      /* GraphQL */ `
        mutation CreateUserApiKey($input: CreateUserApiKeyInput!) {
          createUserApiKey(input: $input) {
            apiKey
          }
        }
      `,
      {
        cookies: target.cookies,
        variables: {
          input: {
            name: 'Invalid user key',
            permissions: ['UNKNOWN__EXECUTE'],
          },
        },
      },
    );
    expectGraphQLError(invalidUserKey);
  });

  it('resolves User.sessions as application Session objects without exposing tokens', async () => {
    const administrator = await createAuthenticatedUser(
      'Session Administrator',
    );
    const target = await createAuthenticatedUser('Session Target');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        administrator.user.id,
      ]);
    const query = `query($id: ID!) { user(id: $id) { sessions(first: 100) { edges { node { __typename id current expiresAt ipAddress userAgent impersonatedById createdAt updatedAt } } } } }`;
    const listed = await gql(query, {
      cookies: administrator.cookies,
      variables: { id: target.user.id },
    });
    expectNoGraphQLErrors(listed);
    expect(listed.body.data.user.sessions.edges).toHaveLength(1);
    expect(listed.body.data.user.sessions.edges[0].node).toMatchObject({
      __typename: 'Session',
      current: false,
      impersonatedById: null,
    });
    const own = await gql(query, {
      cookies: administrator.cookies,
      variables: { id: administrator.user.id },
    });
    expectNoGraphQLErrors(own);
    expect(own.body.data.user.sessions.edges[0].node.current).toBe(true);
    const denied = await gql(
      'query { currentUser { sessions(first: 100) { edges { node { id } } } } }',
      {
        cookies: target.cookies,
      },
    );
    expectNoGraphQLErrors(denied);
    expect(denied.body.data.currentUser.sessions.edges).toHaveLength(1);
    const credentials = await gql(
      'query { currentUser { sessions { edges { node { token } } } } }',
      {
        cookies: target.cookies,
      },
    );
    expectGraphQLError(credentials);
    expect(credentials.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('paginates users and own sessions with cursors, without returning expired or foreign sessions', async () => {
    const prefix = `Pagination${Date.now()}`;
    const owner = await createAuthenticatedUser(`${prefix} First`);
    const other = await createAuthenticatedUser(`${prefix} Second`);
    const admin = await createAuthenticatedUser('Connection Administrator');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        admin.user.id,
      ]);
    const query = `query($after: String, $query: String) { users(first: 1, after: $after, query: $query) { totalCount edges { node { id } } pageInfo { hasNextPage endCursor } } }`;
    const first = await gql(query, {
      cookies: admin.cookies,
      variables: { query: prefix + '*' },
    });
    expectNoGraphQLErrors(first);
    expect(first.body.data.users.totalCount).toBe(2);
    expect(first.body.data.users.pageInfo.hasNextPage).toBe(true);
    const second = await gql(query, {
      cookies: admin.cookies,
      variables: {
        query: prefix + '*',
        after: first.body.data.users.pageInfo.endCursor,
      },
    });
    expectNoGraphQLErrors(second);
    expect(second.body.data.users.pageInfo.hasNextPage).toBe(false);
    expect(
      [
        first.body.data.users.edges[0].node.id,
        second.body.data.users.edges[0].node.id,
      ].sort(),
    ).toEqual([owner.user.id, other.user.id].sort());
    expectGraphQLError(await gql(query, { cookies: owner.cookies }));

    await signInWithEmail({ email: owner.email, password: owner.password });
    await migrationOrm.em
      .getConnection()
      .execute(
        `insert into session (id, token, user_id, expires_at) values (gen_random_uuid(), ?, ?, now() - interval '1 day')`,
        [`expired-${prefix}`, owner.user.id],
      );
    const sessions = `query($after: String) { currentUser { sessions(first: 1, after: $after) { totalCount edges { node { id current } } pageInfo { hasNextPage endCursor } } accounts(first: 20) { edges { node { id } } } } }`;
    const sessionFirst = await gql(sessions, { cookies: owner.cookies });
    expectNoGraphQLErrors(sessionFirst);
    const connection = sessionFirst.body.data.currentUser.sessions;
    expect(connection.totalCount).toBe(2);
    expect(connection.pageInfo.hasNextPage).toBe(true);
    const sessionNext = await gql(sessions, {
      cookies: owner.cookies,
      variables: { after: connection.pageInfo.endCursor },
    });
    expectNoGraphQLErrors(sessionNext);
    expect(
      sessionNext.body.data.currentUser.sessions.pageInfo.hasNextPage,
    ).toBe(false);
    expect(
      sessionNext.body.data.currentUser.sessions.edges[0].node.id,
    ).not.toBe(connection.edges[0].node.id);
    const secret = await gql(
      'query { currentUser { accounts(first: 20) { edges { node { password accessToken refreshToken idToken } } } } }',
      { cookies: owner.cookies },
    );
    expectGraphQLError(secret);
    expect(secret.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('paginates account bindings without exposing another user or accepting API keys', async () => {
    const owner = await createAuthenticatedUser('Account pagination owner');
    const other = await createAuthenticatedUser('Other account owner');
    const connection = migrationOrm.em.getConnection();
    for (const provider of ['test-a', 'test-b']) {
      await connection.execute(
        `insert into account (id, account_id, issuer, provider_id, user_id, access_token, refresh_token, id_token) values (gen_random_uuid(), ?, ?, ?, ?, 'private-access', 'private-refresh', 'private-id')`,
        [provider, provider, provider, owner.user.id],
      );
    }
    const query = `query($after: String, $before: String, $first: Int, $last: Int, $filter: AccountFilter) {
      currentUser { accounts(first: $first, last: $last, after: $after, before: $before, filter: $filter) {
        totalCount edges { node { id providerId } } pageInfo { hasNextPage endCursor startCursor }
      } }
    }`;
    const first = await gql(query, {
      cookies: owner.cookies,
      variables: { first: 2 },
    });
    expectNoGraphQLErrors(first);
    const page = first.body.data.currentUser.accounts;
    expect(page.totalCount).toBe(3);
    expect(page.edges).toHaveLength(2);
    expect(page.pageInfo.hasNextPage).toBe(true);
    const second = await gql(query, {
      cookies: owner.cookies,
      variables: { first: 2, after: page.pageInfo.endCursor },
    });
    expectNoGraphQLErrors(second);
    const nextPage = second.body.data.currentUser.accounts;
    expect(nextPage.pageInfo.hasNextPage).toBe(false);
    expect(
      [...page.edges, ...nextPage.edges]
        .map(({ node }: { node: { providerId: string } }) => node.providerId)
        .sort(),
    ).toEqual(['credential', 'test-a', 'test-b']);
    const previous = await gql(query, {
      cookies: owner.cookies,
      variables: { last: 2, before: nextPage.pageInfo.startCursor },
    });
    expectNoGraphQLErrors(previous);
    expect(previous.body.data.currentUser.accounts.edges).toEqual(page.edges);
    await connection.execute(
      `insert into account (id, account_id, issuer, provider_id, user_id) values (gen_random_uuid(), 'foreign-only', 'foreign-only', 'foreign-only', ?)`,
      [other.user.id],
    );
    const filtered = await gql(query, {
      cookies: owner.cookies,
      variables: {
        first: 10,
        filter: { provider_id: { $eq: 'foreign-only' } },
      },
    });
    expectNoGraphQLErrors(filtered);
    expect(filtered.body.data.currentUser.accounts.totalCount).toBe(0);
    const key = await createUserApiKey(owner, {
      name: 'No account access',
      permissions: [],
    });
    expectGraphQLError(
      await gql(query, { bearerToken: key.apiKey, variables: { first: 10 } }),
    );
    expectGraphQLError(await gql(query, { variables: { first: 10 } }));
    expectGraphQLError(
      await gql(
        'query($id: ID!) { user(id: $id) { accounts(first: 10) { totalCount } } }',
        {
          cookies: owner.cookies,
          variables: { id: other.user.id },
        },
      ),
    );
  });

  it('starts and stops administrator impersonation with signed session cookies', async () => {
    const administrator = await createAuthenticatedUser(
      'Impersonation Administrator',
    );
    const target = await createAuthenticatedUser('Impersonation Target');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        administrator.user.id,
      ]);
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        target.user.id,
      ]);

    const restrictedKey = await createUserApiKey(administrator, {
      name: 'Restricted impersonation key',
      permissions: ['USER__IMPERSONATE'],
    });
    const rejectedAdminImpersonation = await gql(
      /* GraphQL */ `
        mutation ImpersonateUser($id: ID!) {
          impersonateUser(id: $id) {
            id
            accounts(first: 20) {
              edges {
                node {
                  id
                }
              }
            }
            sessions(first: 100) {
              edges {
                node {
                  id
                  current
                }
              }
            }
          }
        }
      `,
      {
        bearerToken: restrictedKey.apiKey,
        variables: { id: target.user.id },
      },
    );

    expectGraphQLError(rejectedAdminImpersonation);

    const started = await gql(
      /* GraphQL */ `
        mutation ImpersonateUser($id: ID!) {
          impersonateUser(id: $id) {
            id
            accounts(first: 20) {
              edges {
                node {
                  id
                }
              }
            }
            sessions(first: 100) {
              edges {
                node {
                  id
                  current
                }
              }
            }
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: { id: target.user.id },
      },
    );
    const impersonationCookies = collectSetCookies(started);

    expectNoGraphQLErrors(started);
    expect(started.body.data.impersonateUser.id).toBe(target.user.id);
    expect(started.body.data.impersonateUser.accounts.edges).toHaveLength(1);
    expect(
      started.body.data.impersonateUser.sessions.edges.some(
        ({ node }: { node: { current: boolean } }) => node.current,
      ),
    ).toBe(true);
    expect(impersonationCookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('better-auth.session_token='),
      ]),
    );

    const impersonated = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
          currentSession {
            impersonatedById
          }
        }
      `,
      { cookies: impersonationCookies },
    );

    expectNoGraphQLErrors(impersonated);
    expect(impersonated.body.data).toEqual({
      currentUser: { id: target.user.id },
      currentSession: { impersonatedById: administrator.user.id },
    });

    const stopped = await gql(
      /* GraphQL */ `
        mutation {
          stopImpersonating {
            id
            accounts(first: 20) {
              edges {
                node {
                  id
                }
              }
            }
            sessions(first: 100) {
              edges {
                node {
                  id
                  current
                }
              }
            }
          }
        }
      `,
      { cookies: impersonationCookies },
    );
    const restoredCookies = collectSetCookies(stopped);

    expectNoGraphQLErrors(stopped);
    expect(stopped.body.data.stopImpersonating.id).toBe(administrator.user.id);
    expect(stopped.body.data.stopImpersonating.accounts.edges).toHaveLength(1);
    expect(
      stopped.body.data.stopImpersonating.sessions.edges.some(
        ({ node }: { node: { current: boolean } }) => node.current,
      ),
    ).toBe(true);

    const restored = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
          currentSession {
            impersonatedById
          }
        }
      `,
      { cookies: restoredCookies },
    );
    expectNoGraphQLErrors(restored);
    expect(restored.body.data).toEqual({
      currentUser: { id: administrator.user.id },
      currentSession: { impersonatedById: null },
    });
    expectGraphQLError(
      await gql(
        /* GraphQL */ `
          query {
            currentUser {
              id
            }
          }
        `,
        { cookies: impersonationCookies },
      ),
    );
  });

  it('commits impersonation revocation before rejecting restoration of a banned administrator', async () => {
    const administrator = await createAuthenticatedUser('Banned Impersonator');
    const target = await createAuthenticatedUser('Restoration Target');
    const connection = migrationOrm.em.getConnection();
    await connection.execute(
      `update "user" set roles = array['admin'] where id = ?`,
      [administrator.user.id],
    );
    const started = await gql(
      'mutation($id: ID!) { impersonateUser(id: $id) { id } }',
      {
        cookies: administrator.cookies,
        variables: { id: target.user.id },
      },
    );
    expectNoGraphQLErrors(started);
    const cookies = collectSetCookies(started);
    const readSessions = () =>
      connection.execute(
        'select id from session where impersonated_by_id = ?',
        [administrator.user.id],
      );
    expect(await readSessions()).toHaveLength(1);
    await connection.execute(
      'update "user" set banned = true, ban_expires_at = null where id = ?',
      [administrator.user.id],
    );
    const stopped = await gql('mutation { stopImpersonating { id } }', {
      cookies,
    });
    expect(stopped.body.errors).toEqual([
      expect.objectContaining({
        message: 'Banned administrators cannot restore their session',
      }),
    ]);
    expect(await readSessions()).toEqual([]);
    expectGraphQLError(await gql('query { currentUser { id } }', { cookies }));
    expectNoGraphQLErrors(
      await gql('query { currentUser { id } }', { cookies: target.cookies }),
    );
  });

  it('revokes administrator impersonation sessions without revoking the target user sessions', async () => {
    const administrator = await createAuthenticatedUser(
      'Revoked Administrator',
    );
    const target = await createAuthenticatedUser('Impersonated User');
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        administrator.user.id,
      ]);

    const started = await gql(
      /* GraphQL */ `
        mutation ImpersonateUser($id: ID!) {
          impersonateUser(id: $id) {
            id
          }
        }
      `,
      { cookies: administrator.cookies, variables: { id: target.user.id } },
    );
    expectNoGraphQLErrors(started);
    const impersonationCookies = collectSetCookies(started);

    const revoked = await gql(
      /* GraphQL */ `
        mutation RevokeUserSessions($userId: ID!) {
          revokeUserSessions(userId: $userId)
        }
      `,
      {
        cookies: administrator.cookies,
        variables: { userId: administrator.user.id },
      },
    );
    expectNoGraphQLErrors(revoked);
    expect(revoked.body.data.revokeUserSessions).toBe(true);

    const restored = await gql(
      /* GraphQL */ `
        mutation {
          stopImpersonating {
            id
          }
        }
      `,
      { cookies: impersonationCookies },
    );
    expect(restored.body.errors).toEqual([
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    ]);
    expect(
      collectRawSetCookies(restored).some((cookie) =>
        /session_token=[^;]/.test(cookie),
      ),
    ).toBe(false);

    for (const cookies of [administrator.cookies, impersonationCookies]) {
      const rejected = await gql(
        /* GraphQL */ `
          query {
            currentUser {
              id
            }
          }
        `,
        { cookies },
      );
      expect(rejected.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      ]);
    }

    const unaffected = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
        }
      `,
      { cookies: target.cookies },
    );
    expectNoGraphQLErrors(unaffected);
    expect(unaffected.body.data.currentUser.id).toBe(target.user.id);
    const sessions = await migrationOrm.em
      .getConnection()
      .execute(
        'select id from session where user_id = ? or impersonated_by_id = ?',
        [administrator.user.id, administrator.user.id],
      );
    expect(sessions).toEqual([]);
  });

  it.each([false, true])(
    'restores the caller role after a single-connection invitation lookup (failure=%s)',
    async (failure) => {
      const user = await createAuthenticatedUser('Identity lookup target');
      const orm = await MikroORM.init({
        clientUrl: databaseUrl,
        driver: PostgreSqlDriver,
        entities: [DbProbeSchema],
        pool: { min: 0, max: 1 },
        driverOptions: { connectionTimeoutMillis: 1000 },
      });
      try {
        const em = orm.em.fork({
          session: {
            role: 'authenticated',
            variables: { 'app.user.id': '', 'app.user.permissions': '[]' },
          },
        });
        await em.transactional(async (transaction) => {
          const [before] = await transaction.execute(
            'select current_user as role, pg_backend_pid() as pid',
          );
          expect(before.role).toBe('authenticated');
          expect(
            await transaction.execute('select id from "user" where id = ?', [
              user.user.id,
            ]),
          ).toEqual([]);
          const service = createContextualAuthService(
            transaction,
            (manager) => ({
              async lookup() {
                const connection = manager.getConnection();
                const ctx = manager.getTransactionContext();
                if (failure)
                  await connection.execute('select 1 / 0', [], 'all', ctx);
                return await connection.execute(
                  'select id, pg_backend_pid() as pid from "user" where id = ?',
                  [user.user.id],
                  'all',
                  ctx,
                );
              },
            }),
            { lookup: 'invitation-identity' },
          );
          if (failure) await expect(service.lookup()).rejects.toThrow();
          else
            expect(await service.lookup()).toEqual([
              { id: user.user.id, pid: before.pid },
            ]);
          expect(
            await transaction.execute(
              'select current_user as role, pg_backend_pid() as pid',
            ),
          ).toEqual([before]);
          expect(
            await transaction.execute('select id from "user" where id = ?', [
              user.user.id,
            ]),
          ).toEqual([]);
        });
      } finally {
        await orm.close();
      }
    },
  );

  it.each(['user', 'workspace'] as const)(
    'revokes stale authorization after changing the authenticating %s key',
    async (scope) => {
      for (const action of ['permissions', 'disable', 'delete'] as const) {
        const owner = await createAuthenticatedUser('Key authorization owner');
        const workspace = await createWorkspace(
          owner,
          'Retained key workspace',
        );
        const input = {
          name: 'Active key',
          permissions: [
            'API_KEY__UPDATE',
            'API_KEY__DELETE',
            'WORKSPACE__DELETE',
          ],
        };
        const key =
          scope === 'user'
            ? await createUserApiKey(owner, input)
            : await createWorkspaceApiKey(owner, workspace.id, input);
        const suffix = scope === 'user' ? 'UserApiKey' : 'WorkspaceApiKey';
        const first =
          action === 'delete'
            ? `delete${suffix}(id: $keyId)`
            : `update${suffix}(id: $keyId, input: ${action === 'disable' ? '{ enabled: false }' : '{ permissions: [] }'})`;
        const response = await gql(
          `mutation ($keyId: ID!, $id: ID!) { first: ${first} { id } deleteWorkspace(id: $id) { id } }`,
          {
            bearerToken: key.apiKey,
            workspaceId: workspace.id,
            variables: { keyId: key.entity.id, id: workspace.id },
          },
        );
        expectGraphQLError(response);
        expect(response.body.errors[0].path).toEqual(['deleteWorkspace']);
        expect(response.body.errors[0].extensions.code).toBe(
          action === 'permissions' ? 'FORBIDDEN' : 'UNAUTHORIZED',
        );
        expect(
          await migrationOrm.em.execute(
            'select deleted_at from workspace where id = ?',
            [workspace.id],
          ),
        ).toEqual([{ deleted_at: null }]);
        const table = scope === 'user' ? 'user_api_key' : 'workspace_api_key';
        const rows = await migrationOrm.em.execute(
          `select enabled, permissions from ${table} where id = ?`,
          [key.entity.id],
        );
        if (action === 'delete') expect(rows).toEqual([]);
        else if (action === 'disable') expect(rows[0].enabled).toBe(false);
        else expect(rows[0].permissions).toEqual([]);
      }
    },
  );

  it('clears authentication after signing out before the next mutation', async () => {
    const owner = await createAuthenticatedUser('Signing out owner');
    const response = await gql(
      'mutation { signOut createWorkspace(input: { name: "Must not exist" }) { id } }',
      { cookies: owner.cookies },
    );
    expectGraphQLError(response);
    expect(response.body.errors[0].path).toEqual(['createWorkspace']);
    expect(response.body.errors[0].extensions.code).toBe('UNAUTHORIZED');
    expect(
      await migrationOrm.em.execute(
        'select id from session where user_id = ?',
        [owner.user.id],
      ),
    ).toEqual([]);
    expect(
      await migrationOrm.em.execute('select id from workspace where name = ?', [
        'Must not exist',
      ]),
    ).toEqual([]);
  });

  it('uses the refreshed profile in a subsequent workspace creation', async () => {
    const owner = await createAuthenticatedUser('Original profile');
    const response = await gql(
      'mutation { updateCurrentUser(input: { name: "Updated profile" }) createWorkspace(input: { name: "Updated member profile" }) { id } }',
      { cookies: owner.cookies },
    );
    expectNoGraphQLErrors(response);
    expect(
      await migrationOrm.em.execute(
        'select name from member where user_id = ? and workspace_id = ?',
        [owner.user.id, response.body.data.createWorkspace.id],
      ),
    ).toEqual([{ name: 'Updated profile' }]);
  });

  it.each(['roles', 'permissions', 'status'] as const)(
    'refreshes workspace authorization after changing own %s between serial mutations',
    async (field) => {
      const owner = await createAuthenticatedUser('Demoting member');
      const workspace = await createWorkspace(owner, 'Demotion workspace');
      const [member] = await migrationOrm.em.execute<{ id: string }[]>(
        'select id from member where user_id = ? and workspace_id = ?',
        [owner.user.id, workspace.id],
      );
      if (field === 'permissions') {
        await migrationOrm.em.execute(
          `update member set roles = array['member'], permissions = array['member:update', 'workspace:delete'] where id = ?`,
          [member.id],
        );
      }
      const first =
        field === 'roles'
          ? 'setMemberRoles(id: $memberId, input: { roles: [MEMBER] })'
          : field === 'permissions'
            ? 'setMemberPermissions(id: $memberId, input: { permissions: [] })'
            : 'updateMember(id: $memberId, input: { status: DISABLED })';
      const response = await gql(
        `mutation ($memberId: ID!, $id: ID!) { first: ${first} { id } deleteWorkspace(id: $id) { id } }`,
        {
          cookies: owner.cookies,
          workspaceId: workspace.id,
          variables: { memberId: member.id, id: workspace.id },
        },
      );
      expectGraphQLError(response);
      expect(response.body.errors[0].path).toEqual(['deleteWorkspace']);
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
      expect(
        await migrationOrm.em.execute(
          'select deleted_at from workspace where id = ?',
          [workspace.id],
        ),
      ).toEqual([{ deleted_at: null }]);
      const [updated] = await migrationOrm.em.execute(
        'select roles, permissions, status from member where id = ?',
        [member.id],
      );
      expect(updated[field]).toEqual(
        field === 'roles'
          ? ['member']
          : field === 'permissions'
            ? []
            : 'DISABLED',
      );
    },
  );

  it.each(['roles', 'permissions'] as const)(
    'refreshes user authorization after changing own %s between serial mutations',
    async (field) => {
      const user = await createAuthenticatedUser('Demoting administrator');
      await migrationOrm.em.execute(
        field === 'roles'
          ? `update "user" set roles = array['admin'] where id = ?`
          : `update "user" set permissions = array['user:set-role'] where id = ?`,
        [user.user.id],
      );
      const first =
        field === 'roles'
          ? 'setUserRoles(id: $id, input: { roles: [USER] })'
          : 'setUserPermissions(id: $id, input: { permissions: [] })';
      const response = await gql(
        `mutation ($id: ID!) { first: ${first} { id } second: setUserPermissions(id: $id, input: { permissions: [] }) { id } }`,
        { cookies: user.cookies, variables: { id: user.user.id } },
      );
      expectGraphQLError(response);
      expect(response.body.errors[0].path).toEqual(['second']);
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
      const [updated] = await migrationOrm.em.execute(
        'select roles, permissions from "user" where id = ?',
        [user.user.id],
      );
      expect(updated[field]).toEqual(field === 'roles' ? ['user'] : []);
    },
  );

  it('clears the parent workspace scope after deletion before the next mutation', async () => {
    const owner = await createAuthenticatedUser('Deleting owner');
    const user = await createAuthenticatedUser('Retained member');
    const workspace = await createWorkspace(owner, 'Deleted workspace');
    const member = await addMember(owner, workspace.id, user.email);
    const response = await gql(
      'mutation ($id: ID!, $memberId: ID!) { deleteWorkspace(id: $id) { id } removeMember(id: $memberId) { id } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: { id: workspace.id, memberId: member.id },
      },
    );
    expectGraphQLError(response);
    expect(response.body.errors[0].path).toEqual(['removeMember']);
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(
      await migrationOrm.em.execute('select id from member where id = ?', [
        member.id,
      ]),
    ).toEqual([{ id: member.id }]);
    const [deleted] = await migrationOrm.em.execute(
      'select deleted_at from workspace where id = ?',
      [workspace.id],
    );
    expect(deleted.deleted_at).not.toBeNull();
  });

  it('invalidates workspace authorization between serial mutation fields after leaving', async () => {
    const owner = await createAuthenticatedUser('Departing owner');
    const workspace = await createWorkspace(owner, 'Retained workspace');
    const response = await gql(
      'mutation ($id: ID!) { leaveWorkspace { memberId } deleteWorkspace(id: $id) { id } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: { id: workspace.id },
      },
    );
    expectGraphQLError(response);
    expect(response.body.errors[0].path).toEqual(['deleteWorkspace']);
    expect(
      await migrationOrm.em.execute(
        'select id from member where workspace_id = ? and user_id = ?',
        [workspace.id, owner.user.id],
      ),
    ).toEqual([]);
    expect(
      await migrationOrm.em.execute(
        'select deleted_at from workspace where id = ?',
        [workspace.id],
      ),
    ).toEqual([{ deleted_at: null }]);
    const current = await gql(
      'query { currentUser { id } currentMember { id } currentWorkspace { id } }',
      { cookies: owner.cookies },
    );
    expectNoGraphQLErrors(current);
    expect(current.body.data).toEqual({
      currentUser: { id: owner.user.id },
      currentMember: null,
      currentWorkspace: null,
    });
  });

  it('returns ID-only invitation results without requiring access to the inviter profile', async () => {
    const owner = await createAuthenticatedUser('Invitation payload owner');
    const recipient = await createAuthenticatedUser('Invitation recipient');
    const administrator = await createAuthenticatedUser(
      'Invitation administrator',
    );
    const workspace = await createWorkspace(owner, 'Invitation payloads');
    const member = await addMember(owner, workspace.id, administrator.email);
    await setMemberRoles(owner, workspace.id, member.id, ['ADMIN']);
    for (const action of ['reject', 'cancel'] as const) {
      const invitation = await createInvitation(owner, workspace.id, {
        email: recipient.email,
        roles: ['MEMBER'],
      });
      const response = await gql(
        `mutation ($id: ID!) { ${action}Invitation(id: $id) { __typename id } }`,
        {
          cookies:
            action === 'reject' ? recipient.cookies : administrator.cookies,
          ...(action === 'cancel' ? { workspaceId: workspace.id } : {}),
          variables: { id: invitation.id },
        },
      );
      expectNoGraphQLErrors(response);
      expect(response.body.data[`${action}Invitation`]).toEqual({
        __typename:
          action === 'reject'
            ? 'RejectInvitationPayload'
            : 'CancelInvitationPayload',
        id: invitation.id,
      });
      expect(
        await migrationOrm.em.execute(
          'select status from invitation where id = ?',
          [invitation.id],
        ),
      ).toEqual([{ status: action === 'reject' ? 'rejected' : 'canceled' }]);
    }
  });

  it('allows multiple owners through role updates without an ownership-transfer endpoint', async () => {
    const owner = await createAuthenticatedUser('Role Owner');
    const secondOwner = await createAuthenticatedUser('Second Owner');
    const workspace = await createWorkspace(owner, 'Multiple Owners');
    const member = await addMember(owner, workspace.id, secondOwner.email);
    await setMemberRoles(owner, workspace.id, member.id, ['OWNER']);
    const connection = migrationOrm.em.getConnection();
    const owners = await connection.execute<{ id: string; user_id: string }[]>(
      `select id, user_id from member where workspace_id = ? and 'owner' = any(roles)`,
      [workspace.id],
    );
    expect(owners.map(({ user_id }) => user_id).sort()).toEqual(
      [owner.user.id, secondOwner.user.id].sort(),
    );
    const original = owners.find(({ user_id }) => user_id === owner.user.id);
    await setMemberRoles(secondOwner, workspace.id, original.id, ['ADMIN']);

    const denied = await gql(
      'mutation ($id: ID!, $input: SetMemberRolesInput!) { setMemberRoles(id: $id, input: $input) { id } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: { id: original.id, input: { roles: ['OWNER'] } },
      },
    );
    expectGraphQLError(denied);
    expect(denied.body.errors[0].message).toContain(
      'Workspace permissions exceed issuer permissions',
    );
    const remainingOwners = await connection.execute<{ user_id: string }[]>(
      `select user_id from member where workspace_id = ? and 'owner' = any(roles)`,
      [workspace.id],
    );
    expect(remainingOwners).toEqual([{ user_id: secondOwner.user.id }]);
  });

  it.each(['disable', 'remove', 'leave'] as const)(
    'allows %s of an owner without deleting the workspace',
    async (action) => {
      const owner = await createAuthenticatedUser('Lifecycle Owner');
      const admin = await createAuthenticatedUser('Lifecycle Admin');
      const workspace = await createWorkspace(owner, 'Owner lifecycle');
      const adminMember = await addMember(owner, workspace.id, admin.email);
      await setMemberRoles(owner, workspace.id, adminMember.id, ['ADMIN']);
      const current = await gql('query { currentMember { id } }', {
        cookies: owner.cookies,
        workspaceId: workspace.id,
      });
      expectNoGraphQLErrors(current);
      const id = current.body.data.currentMember.id as string;
      const query =
        action === 'disable'
          ? 'mutation($id: ID!) { updateMember(id: $id, input: { status: DISABLED }) { id } }'
          : action === 'remove'
            ? 'mutation($id: ID!) { removeMember(id: $id) { id } }'
            : 'mutation { leaveWorkspace { memberId } }';
      if (action !== 'leave') {
        const ordinary = await createAuthenticatedUser('Unprivileged Member');
        await addMember(owner, workspace.id, ordinary.email);
        expectGraphQLError(
          await gql(query, {
            cookies: ordinary.cookies,
            workspaceId: workspace.id,
            variables: { id },
          }),
        );
      }
      const result = await gql(query, {
        cookies: action === 'leave' ? owner.cookies : admin.cookies,
        workspaceId: workspace.id,
        variables: { id },
      });
      expectNoGraphQLErrors(result);
      const rows = await migrationOrm.em
        .getConnection()
        .execute<
          { status: string }[]
        >('select status from member where id = ?', [id]);
      expect(rows).toEqual(
        action === 'disable' ? [{ status: 'DISABLED' }] : [],
      );
      const [retained] = await migrationOrm.em
        .getConnection()
        .execute<
          { deleted_at: Date | null }[]
        >('select deleted_at from workspace where id = ?', [workspace.id]);
      expect(retained.deleted_at).toBeNull();
    },
  );

  it.each(['member', 'invitation', 'acceptance'] as const)(
    'blocks %s after a concurrent workspace deletion',
    async (kind) => {
      const owner = await createAuthenticatedUser('Deletion Race Owner');
      const invitee = await createAuthenticatedUser('Deletion Race Invitee');
      const workspace = await createWorkspace(owner, 'Deletion Race');
      const invitation =
        kind === 'acceptance'
          ? await createInvitation(owner, workspace.id, {
              email: invitee.email,
              roles: ['MEMBER'],
            })
          : null;
      const createOperations = {
        member: () =>
          gql(
            `mutation ($input: AddMemberInput!) { addMember(input: $input) { id } }`,
            {
              cookies: owner.cookies,
              workspaceId: workspace.id,
              variables: { input: { email: invitee.email } },
            },
          ),
        invitation: () =>
          gql(
            `mutation ($input: CreateInvitationInput!) { createInvitation(input: $input) { id } }`,
            {
              cookies: owner.cookies,
              workspaceId: workspace.id,
              variables: { input: { email: invitee.email, roles: ['MEMBER'] } },
            },
          ),
        acceptance: () =>
          gql(
            `mutation ($invitationId: ID!) { acceptInvitation(id: $invitationId) { id } }`,
            {
              cookies: invitee.cookies,
              variables: { invitationId: invitation?.id },
            },
          ),
      };
      const responses = await raceWithWorkspaceLock(workspace.id, [
        () =>
          gql(
            'mutation ($workspaceId: ID!) { deleteWorkspace(id: $workspaceId) { id } }',
            {
              cookies: owner.cookies,
              workspaceId: workspace.id,
            },
          ),
        createOperations[kind],
      ]);
      expectNoGraphQLErrors(responses[0]);
      expect(responses[1].body.errors).toEqual([
        expect.objectContaining({
          message:
            kind === 'acceptance'
              ? 'Workspace has been deleted'
              : 'Workspace not found',
        }),
      ]);
      const connection = migrationOrm.em.getConnection();
      expect(
        await connection.execute(
          'select user_id from member where workspace_id = ?',
          [workspace.id],
        ),
      ).toEqual([{ user_id: owner.user.id }]);
      expect(
        await connection.execute(
          'select status from invitation where workspace_id = ?',
          [workspace.id],
        ),
      ).toEqual(invitation ? [{ status: 'canceled' }] : []);
    },
    20_000,
  );

  it('rechecks invitee identity after waiting for the workspace lock', async () => {
    const owner = await createAuthenticatedUser('Invite Race Owner');
    const workspace = await createWorkspace(owner, 'Invite Identity Race');
    const email = uniqueEmail('late-registration');
    const connection = migrationOrm.em.getConnection();
    let pending: Promise<request.Response> | undefined;
    try {
      await connection.transactional(async (transaction) => {
        await connection.execute(
          'select id from workspace where id = ? for update',
          [workspace.id],
          'all',
          transaction,
        );
        pending = Promise.resolve(
          gql(
            'mutation ($input: CreateInvitationInput!) { createInvitation(input: $input) { id } }',
            {
              cookies: owner.cookies,
              workspaceId: workspace.id,
              variables: { input: { email, roles: ['MEMBER'] } },
            },
          ),
        );
        await vi.waitFor(
          async () => {
            const [waiting] = await connection.execute<{ count: number }[]>(
              `select count(*)::int as count from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%"workspace"%'`,
            );
            expect(waiting.count).toBe(1);
          },
          { timeout: 5000, interval: 20 },
        );
        const user = await createAuthenticatedUser(
          'Late Registered Member',
          email,
        );
        await connection.execute(
          'insert into member (user_id, workspace_id, name) values (?, ?, ?)',
          [user.user.id, workspace.id, 'Late Member'],
          'run',
          transaction,
        );
      });
      const response = await pending;
      expect(response.body.errors).toEqual([
        expect.objectContaining({ message: 'User is already a member' }),
      ]);
      expect(
        await connection.execute(
          'select id from invitation where workspace_id = ?',
          [workspace.id],
        ),
      ).toEqual([]);
    } finally {
      await pending;
    }
  }, 20_000);

  it.each(['add', 'accept'] as const)(
    'keeps invitations terminal when %s wins a concurrent membership creation',
    async (first) => {
      const owner = await createAuthenticatedUser('Membership Race Owner');
      const invitee = await createAuthenticatedUser('Membership Race Invitee');
      const workspace = await createWorkspace(owner, 'Membership Race');
      const invitation = await createInvitation(owner, workspace.id, {
        email: invitee.email,
        roles: ['MEMBER'],
      });
      const operations = {
        add: () =>
          gql(
            `mutation ($input: AddMemberInput!) { addMember(input: $input) { id } }`,
            {
              cookies: owner.cookies,
              workspaceId: workspace.id,
              variables: { input: { email: invitee.email } },
            },
          ),
        accept: () =>
          gql(
            `mutation ($invitationId: ID!) { acceptInvitation(id: $invitationId) { id } }`,
            {
              cookies: invitee.cookies,
              variables: { invitationId: invitation.id },
            },
          ),
      };
      const responses = await raceWithWorkspaceLock(workspace.id, [
        operations[first],
        operations[first === 'add' ? 'accept' : 'add'],
      ]);
      expectNoGraphQLErrors(responses[0]);
      expect(responses[1].body.errors).toEqual([
        expect.objectContaining({
          message:
            first === 'add'
              ? 'Workspace invitation is not pending'
              : 'User is already a member',
        }),
      ]);
      const connection = migrationOrm.em.getConnection();
      expect(
        await connection.execute(
          'select user_id from member where workspace_id = ? and user_id = ?',
          [workspace.id, invitee.user.id],
        ),
      ).toEqual([{ user_id: invitee.user.id }]);
      expect(
        await connection.execute('select status from invitation where id = ?', [
          invitation.id,
        ]),
      ).toEqual([{ status: first === 'add' ? 'canceled' : 'accepted' }]);
      const pending = await gql(
        'query { currentUser { invitations(first: 20) { edges { node { id } } } } }',
        { cookies: invitee.cookies },
      );
      expectNoGraphQLErrors(pending);
      expect(pending.body.data.currentUser.invitations.edges).toEqual([]);
    },
    20_000,
  );

  it('returns forbidden when leaving without a current member', async () => {
    const user = await createAuthenticatedUser('Non Member');
    const owner = await createAuthenticatedUser('Other Owner');
    const workspace = await createWorkspace(owner, 'Other Workspace');
    for (const workspaceId of [undefined, workspace.id]) {
      const response = await gql('mutation { leaveWorkspace { memberId } }', {
        cookies: user.cookies,
        workspaceId,
      });
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      ]);
    }
  });

  it('resolves workspace context from header and cookie while returning null for missing member context', async () => {
    const alice = await createAuthenticatedUser('Alice');
    const bob = await createAuthenticatedUser('Bob');
    const aliceWorkspace = await createWorkspace(alice, 'Alice Workspace');
    const bobWorkspace = await createWorkspace(bob, 'Bob Workspace');

    const fromHeader = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentMember {
            id
            roles
            user {
              email
            }
          }
        }
      `,
      { cookies: alice.cookies, workspaceId: aliceWorkspace.id },
    );

    expectNoGraphQLErrors(fromHeader);
    expect(fromHeader.body.data.currentWorkspace).toEqual(aliceWorkspace);
    expect(fromHeader.body.data.currentMember).toMatchObject({
      roles: ['OWNER'],
      user: {
        email: alice.email,
      },
    });

    const fromCookie = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentMember {
            roles
          }
        }
      `,
      {
        cookies: [...alice.cookies, `workspace_id=${aliceWorkspace.id}`],
      },
    );

    expectNoGraphQLErrors(fromCookie);
    expect(fromCookie.body.data.currentWorkspace).toEqual(aliceWorkspace);
    expect(fromCookie.body.data.currentMember.roles).toEqual(['OWNER']);

    const crossWorkspace = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentMember {
            id
          }
          currentSession {
            id
          }
        }
      `,
      { cookies: alice.cookies, workspaceId: bobWorkspace.id },
    );

    expectGraphQLError(crossWorkspace);
    expect(crossWorkspace.body.data.currentWorkspace).toBeNull();
    expect(crossWorkspace.body.data.currentMember).toBeNull();
    expect(crossWorkspace.body.data.currentSession.id).toEqual(
      expect.any(String),
    );

    const withoutWorkspace = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
          currentMember {
            id
          }
        }
      `,
      { cookies: alice.cookies },
    );

    expectNoGraphQLErrors(withoutWorkspace);
    expect(withoutWorkspace.body.data.currentWorkspace).toBeNull();
    expect(withoutWorkspace.body.data.currentMember).toBeNull();

    const aliceWorkspaces = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            workspaces(first: 10) {
              totalCount
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      { cookies: alice.cookies, workspaceId: aliceWorkspace.id },
    );

    expectNoGraphQLErrors(aliceWorkspaces);
    expect(aliceWorkspaces.body.data.currentUser.workspaces).toMatchObject({
      totalCount: 1,
      edges: [
        {
          node: aliceWorkspace,
        },
      ],
    });
  });

  it('lists all workspaces for the current user even when a workspace is active', async () => {
    const user = await createAuthenticatedUser('Workspace Switcher User');
    const firstWorkspace = await createWorkspace(
      user,
      'First Switcher Workspace',
    );
    const secondWorkspace = await createWorkspace(
      user,
      'Second Switcher Workspace',
    );

    const response = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            workspaces(first: 10) {
              totalCount
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      { cookies: user.cookies, workspaceId: firstWorkspace.id },
    );

    expectNoGraphQLErrors(response);
    expect(response.body.data.currentUser.workspaces.totalCount).toBe(2);
    expect(response.body.data.currentUser.workspaces.edges).toEqual(
      expect.arrayContaining([
        {
          node: firstWorkspace,
        },
        {
          node: secondWorkspace,
        },
      ]),
    );
  });

  it('updates and soft-deletes workspaces while enforcing member role rules', async () => {
    const owner = await createAuthenticatedUser('Workspace Owner');
    const memberUser = await createAuthenticatedUser('Workspace Member');
    const workspace = await createWorkspace(owner, 'Lifecycle Workspace');
    const member = await addMember(owner, workspace.id, memberUser.email);

    const rejectedMemberUpdate = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspace(
          $workspaceId: ID!
          $input: UpdateWorkspaceInput!
        ) {
          updateWorkspace(id: $workspaceId, input: $input) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
        variables: {
          input: {
            name: 'Rejected Workspace Name',
          },
        },
      },
    );

    expectGraphQLError(rejectedMemberUpdate);

    await setMemberRoles(owner, workspace.id, member.id, ['ADMIN']);

    const updatedByAdmin = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspace(
          $workspaceId: ID!
          $input: UpdateWorkspaceInput!
        ) {
          updateWorkspace(id: $workspaceId, input: $input) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
        variables: {
          input: {
            name: 'Renamed Lifecycle Workspace',
          },
        },
      },
    );

    expectNoGraphQLErrors(updatedByAdmin);
    expect(updatedByAdmin.body.data.updateWorkspace).toEqual({
      id: workspace.id,
    });
    expect(
      await migrationOrm.em.execute('select name from workspace where id = ?', [
        workspace.id,
      ]),
    ).toEqual([{ name: 'Renamed Lifecycle Workspace' }]);

    const rejectedAdminDelete = await gql(
      /* GraphQL */ `
        mutation ($workspaceId: ID!) {
          deleteWorkspace(id: $workspaceId) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectGraphQLError(rejectedAdminDelete);

    const deleted = await gql(
      /* GraphQL */ `
        mutation ($workspaceId: ID!) {
          deleteWorkspace(id: $workspaceId) {
            id
            __typename
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(deleted);
    expect(deleted.body.data.deleteWorkspace).toMatchObject({
      id: workspace.id,
      __typename: 'DeleteWorkspacePayload',
    });

    const deletedLookup = await gql(
      /* GraphQL */ `
        query Workspace($id: ID!) {
          workspace(id: $id) {
            id
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: workspace.id,
        },
      },
    );

    expectNoGraphQLErrors(deletedLookup);
    expect(deletedLookup.body.data.workspace).toBeNull();
  });

  it('paginates invitation fields without escaping their parent authorization scope', async () => {
    const owner = await createAuthenticatedUser('Invitation Page Owner');
    const recipient = await createAuthenticatedUser(
      'Invitation Page Recipient',
    );
    const workspaces = await Promise.all([
      createWorkspace(owner, 'Invitation Page A'),
      createWorkspace(owner, 'Invitation Page B'),
    ]);
    const invitations = [];
    for (const workspace of workspaces) {
      invitations.push(
        await createInvitation(owner, workspace.id, {
          email: recipient.email,
          roles: ['MEMBER'],
        }),
      );
    }
    const unrelated = await createInvitation(owner, workspaces[0].id, {
      email: 'other-invitation-recipient@example.com',
      roles: ['MEMBER'],
    });
    const userQuery = `query($after: String, $before: String, $first: Int, $last: Int, $filter: InvitationFilter) {
      currentUser { invitations(first: $first, last: $last, after: $after, before: $before, filter: $filter) {
        edges { node { id } }
        pageInfo { startCursor endCursor hasNextPage hasPreviousPage }
        totalCount
      } }
    }`;
    const first = await gql(userQuery, {
      cookies: recipient.cookies,
      variables: { first: 1 },
    });
    expectNoGraphQLErrors(first);
    const firstPage = first.body.data.currentUser.invitations;
    expect(firstPage.totalCount).toBe(2);
    expect(firstPage.edges).toHaveLength(1);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);
    const second = await gql(userQuery, {
      cookies: recipient.cookies,
      variables: { first: 1, after: firstPage.pageInfo.endCursor },
    });
    expectNoGraphQLErrors(second);
    const secondPage = second.body.data.currentUser.invitations;
    expect(secondPage.pageInfo.hasNextPage).toBe(false);
    expect(
      [...firstPage.edges, ...secondPage.edges]
        .map(({ node }: { node: { id: string } }) => node.id)
        .sort(),
    ).toEqual(invitations.map(({ id }) => id).sort());
    const previous = await gql(userQuery, {
      cookies: recipient.cookies,
      variables: { last: 1, before: secondPage.pageInfo.startCursor },
    });
    expectNoGraphQLErrors(previous);
    expect(previous.body.data.currentUser.invitations.edges).toEqual(
      firstPage.edges,
    );
    const override = await gql(userQuery, {
      cookies: recipient.cookies,
      variables: { first: 20, filter: { email: { $eq: unrelated.email } } },
    });
    expectNoGraphQLErrors(override);
    expect(override.body.data.currentUser.invitations.totalCount).toBe(0);

    const scoped = await gql(
      `query($filter: InvitationFilter) {
      currentWorkspace { invitations(first: 1, filter: $filter) { edges { node { id } } totalCount pageInfo { hasNextPage } } }
    }`,
      {
        cookies: owner.cookies,
        workspaceId: workspaces[0].id,
        variables: { filter: { status: { $eq: 'pending' } } },
      },
    );
    expectNoGraphQLErrors(scoped);
    expect(scoped.body.data.currentWorkspace.invitations.totalCount).toBe(2);
    expect(scoped.body.data.currentWorkspace.invitations.edges).toHaveLength(1);
    expect(
      scoped.body.data.currentWorkspace.invitations.pageInfo.hasNextPage,
    ).toBe(true);

    for (const field of ['invitations', 'members', 'apiKeys']) {
      const wrongWorkspace = await gql(
        `query($id: ID!) { workspace(id: $id) { ${field}(first: 1) { totalCount } } }`,
        {
          cookies: owner.cookies,
          workspaceId: workspaces[0].id,
          variables: { id: workspaces[1].id },
        },
      );
      expect(wrongWorkspace.body.errors?.[0].extensions.code).toBe('FORBIDDEN');
    }
    await migrationOrm.em
      .getConnection()
      .execute(`update "user" set roles = array['admin'] where id = ?`, [
        owner.user.id,
      ]);
    for (const field of ['invitations', 'workspaces', 'apiKeys']) {
      const wrongUser = await gql(
        `query($id: ID!) { user(id: $id) { ${field}(first: 1) { totalCount } } }`,
        {
          cookies: owner.cookies,
          variables: { id: recipient.user.id },
        },
      );
      expect(wrongUser.body.errors?.[0].extensions.code).toBe('FORBIDDEN');
    }
    await migrationOrm.em
      .getConnection()
      .execute(
        "update invitation set expires_at = now() - interval '1 day' where id = ?",
        [invitations[0].id],
      );
    const unexpired = await gql(userQuery, {
      cookies: recipient.cookies,
      variables: { first: 20 },
    });
    expectNoGraphQLErrors(unexpired);
    expect(unexpired.body.data.currentUser.invitations.edges).toEqual([
      { node: { id: invitations[1].id } },
    ]);
  });

  it('manages members, invite acceptance, and member removal through real auth', async () => {
    const owner = await createAuthenticatedUser('Member Owner');
    const memberUser = await createAuthenticatedUser('Member Target');
    const invitee = await createAuthenticatedUser('Invite Target');
    const wrongInvitee = await createAuthenticatedUser('Wrong Invite Target');
    const workspace = await createWorkspace(owner, 'Member Workspace');
    const member = await addMember(owner, workspace.id, memberUser.email);

    const roleCatalog = await gql(
      /* GraphQL */ `
        query WorkspaceRoleCatalog {
          workspaceRoles {
            role
            grantable
          }
          workspacePermissions {
            permission
            grantable
          }
        }
      `,
      { cookies: owner.cookies, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(roleCatalog);
    expect(roleCatalog.body.data.workspaceRoles).toEqual(
      expect.arrayContaining(
        ['OWNER', 'ADMIN', 'MEMBER'].map((role) => ({ role, grantable: true })),
      ),
    );
    expect(roleCatalog.body.data.workspacePermissions).toContainEqual({
      permission: 'MEMBER__UPDATE',
      grantable: true,
    });

    const currentMember = await gql(
      /* GraphQL */ `
        query {
          currentMember {
            id
            name
            email
            roles
            status
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(currentMember);
    expect(currentMember.body.data.currentMember).toMatchObject({
      id: member.id,
      roles: ['MEMBER'],
      status: 'ACTIVE',
      name: memberUser.user.name,
      email: memberUser.email,
    });

    const deniedWithoutAbility = await gql(
      'mutation ($id: ID!, $input: SetMemberPermissionsInput!) { setMemberPermissions(id: $id, input: $input) { id } }',
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
        variables: { id: member.id, input: { permissions: [] } },
      },
    );
    expectGraphQLError(deniedWithoutAbility);

    const updatedMember = await setMemberPermissions(
      owner,
      workspace.id,
      member.id,
      ['WORKSPACE__UPDATE', 'MEMBER__UPDATE'],
    );

    expect(updatedMember.permissions).toEqual([
      'WORKSPACE__UPDATE',
      'MEMBER__UPDATE',
    ]);

    const memberPermissions = await gql(
      /* GraphQL */ `
        query {
          currentMember {
            permissions
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(memberPermissions);
    expect(memberPermissions.body.data.currentMember).toEqual({
      permissions: ['WORKSPACE__UPDATE', 'MEMBER__UPDATE'],
    });

    // A member's effective update ability, not the owner role, permits grants.
    expect(
      await setMemberPermissions(memberUser, workspace.id, member.id, [
        'WORKSPACE__UPDATE',
        'MEMBER__UPDATE',
      ]),
    ).toMatchObject({ permissions: ['WORKSPACE__UPDATE', 'MEMBER__UPDATE'] });

    const rejectedPermissionEscalation = await gql(
      /* GraphQL */ `
        mutation SetMemberPermissions(
          $id: ID!
          $input: SetMemberPermissionsInput!
        ) {
          setMemberPermissions(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        variables: {
          id: member.id,
          input: { permissions: ['WORKSPACE__DELETE'] },
        },
        workspaceId: workspace.id,
      },
    );

    expectGraphQLError(rejectedPermissionEscalation);
    expect(rejectedPermissionEscalation.body.errors[0].message).toContain(
      'Workspace permissions exceed issuer permissions',
    );

    const rejectedMemberAdd = await gql(
      /* GraphQL */ `
        mutation AddMember($input: AddMemberInput!) {
          addMember(input: $input) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
        variables: {
          input: {
            email: invitee.email,
          },
        },
      },
    );

    expectGraphQLError(rejectedMemberAdd);

    const invite = await createInvitation(owner, workspace.id, {
      email: invitee.email,
      roles: ['MEMBER'],
    });

    const invitationById = await gql(
      /* GraphQL */ `
        query Invitation($id: ID!) {
          invitation(id: $id) {
            id
            email
            roles
            status
            expiresAt
            workspace {
              id
              name
            }
          }
        }
      `,
      {
        cookies: invitee.cookies,
        variables: {
          id: invite.id,
        },
      },
    );

    expectNoGraphQLErrors(invitationById);
    const privateInviter = await gql(
      'query($id: ID!) { invitation(id: $id) { inviter { name email } } }',
      { cookies: invitee.cookies, variables: { id: invite.id } },
    );
    expectGraphQLError(privateInviter);
    expect(privateInviter.body.data?.invitation ?? null).toBeNull();
    const hiddenInvitation = await gql(
      'query($id: ID!) { invitation(id: $id) { id } }',
      {
        cookies: wrongInvitee.cookies,
        workspaceId: workspace.id,
        variables: { id: invite.id },
      },
    );
    expectNoGraphQLErrors(hiddenInvitation);
    expect(hiddenInvitation.body.data.invitation).toBeNull();
    expect(invitationById.body.data.invitation).toMatchObject({
      id: invite.id,
      email: invitee.email,
      roles: ['MEMBER'],
      status: 'PENDING',
      workspace,
    });

    const rejectedWrongEmail = await gql(
      /* GraphQL */ `
        mutation AcceptInvitation($invitationId: ID!) {
          acceptInvitation(id: $invitationId) {
            id
          }
        }
      `,
      {
        cookies: wrongInvitee.cookies,
        variables: {
          invitationId: invite.id,
        },
      },
    );

    expectGraphQLError(rejectedWrongEmail);

    const invalidAcceptance = await gql(
      'mutation($id: ID!) { acceptInvitation(id: $id) { invitation { inviter { id } } } }',
      { cookies: invitee.cookies, variables: { id: invite.id } },
    );
    expect(invalidAcceptance.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            'Cannot query field "invitation" on type "AcceptInvitationPayload"',
          ),
        }),
      ]),
    );
    expect(
      await migrationOrm.em
        .getConnection()
        .execute('select status from invitation where id = ?', [invite.id]),
    ).toEqual([{ status: 'pending' }]);
    expect(
      await migrationOrm.em
        .getConnection()
        .execute(
          'select id from member where workspace_id = ? and user_id = ?',
          [workspace.id, invitee.user.id],
        ),
    ).toEqual([]);

    const accepted = await gql(
      /* GraphQL */ `
        mutation AcceptInvitation($invitationId: ID!) {
          acceptInvitation(id: $invitationId) {
            id
            memberId
            workspaceId
          }
        }
      `,
      {
        cookies: invitee.cookies,
        variables: {
          invitationId: invite.id,
        },
      },
    );

    expectNoGraphQLErrors(accepted);
    expect(accepted.body.data.acceptInvitation).toEqual({
      id: invite.id,
      memberId: expect.any(String),
      workspaceId: workspace.id,
    });
    const acceptedMemberId = accepted.body.data.acceptInvitation.memberId;
    expect(
      await migrationOrm.em
        .getConnection()
        .execute('select status from invitation where id = ?', [invite.id]),
    ).toEqual([{ status: 'accepted' }]);
    expect(
      await migrationOrm.em
        .getConnection()
        .execute('select roles, status, user_id from member where id = ?', [
          acceptedMemberId,
        ]),
    ).toEqual([
      { roles: ['member'], status: 'ACTIVE', user_id: invitee.user.id },
    ]);

    const removed = await gql(
      /* GraphQL */ `
        mutation RemoveMember($id: ID!) {
          removeMember(id: $id) {
            __typename
            id
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: acceptedMemberId,
        },
      },
    );

    expectNoGraphQLErrors(removed);
    expect(removed.body.data.removeMember).toEqual({
      __typename: 'RemoveMemberPayload',
      id: acceptedMemberId,
    });

    const rejectedRemovedMember = await gql(
      /* GraphQL */ `
        query {
          currentMember {
            id
          }
        }
      `,
      {
        cookies: invitee.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(rejectedRemovedMember);
    expect(rejectedRemovedMember.body.data.currentMember).toBeNull();

    const left = await gql(
      'mutation { leaveWorkspace { __typename memberId } }',
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );
    expectNoGraphQLErrors(left);
    expect(left.body.data.leaveWorkspace).toEqual({
      __typename: 'LeaveWorkspacePayload',
      memberId: member.id,
    });
    const afterLeaving = await gql('query { currentMember { id } }', {
      cookies: memberUser.cookies,
      workspaceId: workspace.id,
    });
    expectNoGraphQLErrors(afterLeaving);
    expect(afterLeaving.body.data.currentMember).toBeNull();
  });

  it('reads invitations with a workspace API key while preserving workspace RLS', async () => {
    const owner = await createAuthenticatedUser('Invitation API Owner');
    const workspace = await createWorkspace(owner, 'Invitation API Workspace');
    const otherWorkspace = await createWorkspace(
      owner,
      'Other Invitation Workspace',
    );
    const invitation = await createInvitation(owner, workspace.id, {
      email: uniqueEmail('API invitee'),
      roles: ['MEMBER'],
    });
    const otherInvitation = await createInvitation(owner, otherWorkspace.id, {
      email: uniqueEmail('Other API invitee'),
      roles: ['MEMBER'],
    });
    const key = await createWorkspaceApiKey(owner, workspace.id, {
      name: 'Invitation reader',
      // The example grants invitation reads as a baseline workspace ability.
      permissions: [],
    });
    const response = await gql(
      /* GraphQL */ `
        query Invitations($id: ID!, $otherId: ID!) {
          own: invitation(id: $id) {
            id
            email
            workspace {
              id
            }
          }
          other: invitation(id: $otherId) {
            id
          }
        }
      `,
      {
        bearerToken: key.apiKey,
        variables: { id: invitation.id, otherId: otherInvitation.id },
      },
    );
    expectNoGraphQLErrors(response);
    expect(response.body.data).toEqual({
      own: {
        id: invitation.id,
        email: invitation.email,
        workspace: { id: workspace.id },
      },
      other: null,
    });
  });

  it('authenticates workspace API keys without creating a member identity', async () => {
    const owner = await createAuthenticatedUser('API Owner');
    const workspace = await createWorkspace(owner, 'Workspace API Key');
    const createdKey = await createWorkspaceApiKey(owner, workspace.id, {
      name: 'Runtime key',
      permissions: ['WORKSPACE__UPDATE'],
    });

    const byBearer = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentMember {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey },
    );

    expectNoGraphQLErrors(byBearer);
    expect(byBearer.body.data.currentWorkspace).toEqual(workspace);
    expect(byBearer.body.data.currentMember).toBeNull();

    const membersByBearer = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            members(first: 10) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      { bearerToken: createdKey.apiKey },
    );

    expectNoGraphQLErrors(membersByBearer);
    expect(
      membersByBearer.body.data.currentWorkspace.members.edges,
    ).not.toHaveLength(0);

    const apiKeyWithWorkspaceHeader = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(apiKeyWithWorkspaceHeader);
    expect(apiKeyWithWorkspaceHeader.body.data.currentWorkspace).toEqual({
      id: workspace.id,
    });

    const apiKeyCurrentUser = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey, workspaceId: workspace.id },
    );

    expectGraphQLError(apiKeyCurrentUser);
    expect(apiKeyCurrentUser.body.errors).toEqual([
      expect.objectContaining({
        message: 'A user identity is required',
        extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    ]);

    const sessionTakesPrecedence = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
        }
      `,
      {
        bearerToken: createdKey.apiKey,
        cookies: owner.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(sessionTakesPrecedence);
    expect(sessionTakesPrecedence.body.data.currentUser.id).toBe(owner.user.id);

    const touchedKey = await gql(
      /* GraphQL */ `
        query ApiKey($id: ID!) {
          currentWorkspace {
            apiKey(id: $id) {
              id
              name
              lastUsedAt
              permissions
            }
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: createdKey.entity.id,
        },
      },
    );

    expectNoGraphQLErrors(touchedKey);
    expect(touchedKey.body.data.currentWorkspace.apiKey).toMatchObject({
      id: createdKey.entity.id,
      name: 'Runtime key',
      permissions: ['WORKSPACE__UPDATE'],
    });
    expect(touchedKey.body.data.currentWorkspace.apiKey.lastUsedAt).toEqual(
      expect.any(String),
    );

    const renamed = await gql(
      /* GraphQL */ `
        mutation UpdateApiKey($id: ID!, $input: UpdateWorkspaceApiKeyInput!) {
          updateWorkspaceApiKey(id: $id, input: $input) {
            id
            name
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: createdKey.entity.id,
          input: {
            name: 'Renamed runtime key',
            permissions: ['WORKSPACE__UPDATE'],
          },
        },
      },
    );

    expectNoGraphQLErrors(renamed);
    expect(renamed.body.data.updateWorkspaceApiKey).toEqual({
      id: createdKey.entity.id,
      name: 'Renamed runtime key',
    });
  });

  it('authenticates user API keys and intersects them with live membership', async () => {
    const user = await createAuthenticatedUser('User API Owner');
    const outsider = await createAuthenticatedUser('User API Outsider');
    const workspace = await createWorkspace(user, 'User API Workspace');
    const outsiderWorkspace = await createWorkspace(
      outsider,
      'Outsider Workspace',
    );
    const rejectedEscalatedKey = await gql(
      /* GraphQL */ `
        mutation CreateUserApiKey($input: CreateUserApiKeyInput!) {
          createUserApiKey(input: $input) {
            apiKey
          }
        }
      `,
      {
        cookies: user.cookies,
        variables: {
          input: {
            name: 'Escalated personal key',
            permissions: ['USER__GET'],
          },
        },
      },
    );

    expectGraphQLError(rejectedEscalatedKey);

    const createdKey = await createUserApiKey(user, {
      name: 'Personal automation',
      permissions: ['WORKSPACE__UPDATE', 'MEMBER__UPDATE'],
    });

    const authenticated = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
          currentWorkspace {
            id
          }
          currentMember {
            id
          }
          currentSession {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(authenticated);
    expect(authenticated.body.data.currentUser.id).toBe(user.user.id);
    expect(authenticated.body.data.currentWorkspace.id).toBe(workspace.id);
    expect(authenticated.body.data.currentMember.id).toEqual(
      expect.any(String),
    );
    expect(authenticated.body.data.currentSession).toBeNull();

    const rejectedCrossWorkspace = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
        }
      `,
      {
        bearerToken: createdKey.apiKey,
        workspaceId: outsiderWorkspace.id,
      },
    );

    expectGraphQLError(rejectedCrossWorkspace);

    const listed = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            apiKeys(first: 10) {
              totalCount
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      { cookies: user.cookies },
    );

    expectNoGraphQLErrors(listed);
    expect(listed.body.data.currentUser.apiKeys).toMatchObject({
      totalCount: 1,
      edges: [
        {
          node: {
            id: createdKey.entity.id,
            name: 'Personal automation',
          },
        },
      ],
    });
  });

  it('prevents user API keys from delegating permissions they do not have', async () => {
    const user = await createAuthenticatedUser('Delegated Key Owner');
    const authenticatingKey = await createUserApiKey(user, {
      name: 'Restricted delegator',
      permissions: ['API_KEY__CREATE', 'API_KEY__UPDATE', 'WORKSPACE__UPDATE'],
    });
    const targetKey = await createUserApiKey(user, {
      name: 'Delegation target',
      permissions: ['WORKSPACE__UPDATE'],
    });

    const rejectedCreate = await gql(
      /* GraphQL */ `
        mutation CreateUserApiKey($input: CreateUserApiKeyInput!) {
          createUserApiKey(input: $input) {
            apiKey
          }
        }
      `,
      {
        bearerToken: authenticatingKey.apiKey,
        variables: {
          input: {
            name: 'Escalated delegated key',
            permissions: ['WORKSPACE__DELETE'],
          },
        },
      },
    );
    expectGraphQLError(rejectedCreate);

    const rejectedUpdate = await gql(
      /* GraphQL */ `
        mutation UpdateUserApiKey($id: ID!, $input: UpdateUserApiKeyInput!) {
          updateUserApiKey(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        bearerToken: authenticatingKey.apiKey,
        variables: {
          id: targetKey.entity.id,
          input: { permissions: ['WORKSPACE__DELETE'] },
        },
      },
    );
    expectGraphQLError(rejectedUpdate);

    const allowedCreate = await gql(
      /* GraphQL */ `
        mutation CreateUserApiKey($input: CreateUserApiKeyInput!) {
          createUserApiKey(input: $input) {
            entity {
              permissions
            }
          }
        }
      `,
      {
        bearerToken: authenticatingKey.apiKey,
        variables: {
          input: {
            name: 'Bounded delegated key',
            permissions: ['WORKSPACE__UPDATE'],
          },
        },
      },
    );

    expectNoGraphQLErrors(allowedCreate);
    expect(allowedCreate.body.data.createUserApiKey.entity.permissions).toEqual(
      ['WORKSPACE__UPDATE'],
    );
  });

  it.each(['user', 'workspace'] as const)(
    'limits %s API-key management to explicitly granted actions and bounded credentials',
    async (scope) => {
      const user = await createAuthenticatedUser(`${scope} key manager`);
      const workspace = await createWorkspace(
        user,
        `${scope} managed workspace`,
      );
      const createKey = (permissions: string[]) =>
        scope === 'user'
          ? createUserApiKey(user, { name: 'Managed key', permissions })
          : createWorkspaceApiKey(user, workspace.id, {
              name: 'Managed key',
              permissions,
            });
      const management = [
        'API_KEY__READ',
        'API_KEY__CREATE',
        'API_KEY__UPDATE',
        'API_KEY__DELETE',
      ];
      const manager = await createKey([...management, 'WORKSPACE__UPDATE']);
      const broader = await createKey([...management, 'WORKSPACE__DELETE']);
      const empty = await createKey([]);
      const narrow = await createKey(['WORKSPACE__UPDATE']);
      const names =
        scope === 'user'
          ? {
              parent: 'currentUser',
              create: 'createUserApiKey',
              update: 'updateUserApiKey',
              delete: 'deleteUserApiKey',
            }
          : {
              parent: 'currentWorkspace',
              create: 'createWorkspaceApiKey',
              update: 'updateWorkspaceApiKey',
              delete: 'deleteWorkspaceApiKey',
            };
      const queries = {
        read: `query($id: ID!) { owner: ${names.parent} { result: apiKey(id: $id) { id permissions } } }`,
        list: `query { owner: ${names.parent} { result: apiKeys(first: 100) { totalCount edges { node { id } } } } }`,
        create: `mutation($input: Create${scope === 'user' ? 'User' : 'Workspace'}ApiKeyInput!) { result: ${names.create}(input: $input) { entity { id permissions } } }`,
        update: `mutation($id: ID!, $input: Update${scope === 'user' ? 'User' : 'Workspace'}ApiKeyInput!) { result: ${names.update}(id: $id, input: $input) { id permissions name } }`,
        delete: `mutation($id: ID!) { result: ${names.delete}(id: $id) { id } }`,
      };
      const call = (
        operation: keyof typeof queries,
        bearerToken: string,
        variables: Record<string, unknown> = {},
      ) => gql(queries[operation], { bearerToken, variables });
      const expectForbidden = (result: Awaited<ReturnType<typeof gql>>) => {
        expectGraphQLError(result);
        expect(result.body.errors[0].extensions.code).toBe('FORBIDDEN');
      };

      for (const key of [empty, narrow]) {
        expectForbidden(await call('list', key.apiKey));
        expectForbidden(
          await call('read', key.apiKey, { id: broader.entity.id }),
        );
        expectForbidden(
          await call('create', key.apiKey, {
            input: { name: 'Denied', permissions: [] },
          }),
        );
        expectForbidden(
          await call('update', key.apiKey, {
            id: empty.entity.id,
            input: { name: 'Denied' },
          }),
        );
        expectForbidden(
          await call('delete', key.apiKey, { id: broader.entity.id }),
        );
      }
      const listed = await call('list', manager.apiKey);
      expectNoGraphQLErrors(listed);
      expect(listed.body.data.owner.result.totalCount).toBe(3);
      expect(
        listed.body.data.owner.result.edges
          .map((edge: { node: { id: string } }) => edge.node.id)
          .sort(),
      ).toEqual([manager.entity.id, empty.entity.id, narrow.entity.id].sort());

      const hiddenKey = await call('read', manager.apiKey, {
        id: broader.entity.id,
      });
      expectNoGraphQLErrors(hiddenKey);
      expect(hiddenKey.body.data.owner.result).toBeNull();
      expectForbidden(
        await call('update', manager.apiKey, {
          id: broader.entity.id,
          input: { permissions: [] },
        }),
      );
      expectForbidden(
        await call('delete', manager.apiKey, { id: broader.entity.id }),
      );
      expectForbidden(
        await call('create', manager.apiKey, {
          input: { name: 'Escalated', permissions: ['WORKSPACE__DELETE'] },
        }),
      );
      expectForbidden(
        await call('update', manager.apiKey, {
          id: narrow.entity.id,
          input: { permissions: ['WORKSPACE__DELETE'] },
        }),
      );

      const delegated = await call('create', manager.apiKey, {
        input: { name: 'Delegated', permissions: ['WORKSPACE__UPDATE'] },
      });
      expectNoGraphQLErrors(delegated);
      const id = delegated.body.data.result.entity.id as string;
      const visibleKey = await call('read', manager.apiKey, { id });
      expectNoGraphQLErrors(visibleKey);
      expect(visibleKey.body.data.owner.result).toMatchObject({
        id,
        permissions: ['WORKSPACE__UPDATE'],
      });
      const renamed = await call('update', manager.apiKey, {
        id,
        input: { name: 'Renamed' },
      });
      expectNoGraphQLErrors(renamed);
      expect(renamed.body.data.result.name).toBe('Renamed');
      expectNoGraphQLErrors(await call('delete', manager.apiKey, { id }));

      const otherUser = await createAuthenticatedUser(`${scope} other owner`);
      const otherWorkspace = await createWorkspace(
        otherUser,
        `${scope} other workspace`,
      );
      const otherKey =
        scope === 'user'
          ? await createUserApiKey(otherUser, {
              name: 'Other key',
              permissions: [],
            })
          : await createWorkspaceApiKey(otherUser, otherWorkspace.id, {
              name: 'Other key',
              permissions: [],
            });
      const foreignKey = await call('read', manager.apiKey, {
        id: otherKey.entity.id,
      });
      expectNoGraphQLErrors(foreignKey);
      expect(foreignKey.body.data.owner.result).toBeNull();
      const hiddenDeletion = await call('delete', manager.apiKey, {
        id: otherKey.entity.id,
      });
      expectGraphQLError(hiddenDeletion);
      expect(hiddenDeletion.body.errors[0].extensions.code).toBe('NOT_FOUND');

      // A browser session still manages every key owned by this user/workspace.
      const sessionList = await gql(queries.list, {
        cookies: user.cookies,
        workspaceId: workspace.id,
      });
      expectNoGraphQLErrors(sessionList);
      expect(sessionList.body.data.owner.result.totalCount).toBe(4);
    },
  );

  it('enforces workspace API-key permissions and enabled state', async () => {
    const owner = await createAuthenticatedUser('Restricted Key Owner');
    const workspace = await createWorkspace(owner, 'Restricted API Workspace');
    const restrictedKey = await createWorkspaceApiKey(owner, workspace.id, {
      name: 'Read workspace key',
      permissions: ['WORKSPACE__UPDATE'],
    });

    const allowed = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
        }
      `,
      { bearerToken: restrictedKey.apiKey },
    );

    expectNoGraphQLErrors(allowed);
    expect(allowed.body.data.currentWorkspace).toEqual(workspace);

    const updated = await gql(
      /* GraphQL */ `
        mutation ($workspaceId: ID!) {
          updateWorkspace(
            id: $workspaceId
            input: { name: "Updated by API Key" }
          ) {
            id
          }
        }
      `,
      {
        bearerToken: restrictedKey.apiKey,
        variables: { workspaceId: workspace.id },
      },
    );

    expectNoGraphQLErrors(updated);
    expect(updated.body.data.updateWorkspace).toEqual({
      id: workspace.id,
    });
    expect(
      await migrationOrm.em.execute('select name from workspace where id = ?', [
        workspace.id,
      ]),
    ).toEqual([{ name: 'Updated by API Key' }]);

    const denied = await gql(
      /* GraphQL */ `
        mutation ($workspaceId: ID!) {
          deleteWorkspace(id: $workspaceId) {
            id
          }
        }
      `,
      {
        bearerToken: restrictedKey.apiKey,
        variables: { workspaceId: workspace.id },
      },
    );

    expectGraphQLError(denied);

    const disabled = await gql(
      /* GraphQL */ `
        mutation UpdateApiKey($id: ID!, $input: UpdateWorkspaceApiKeyInput!) {
          updateWorkspaceApiKey(id: $id, input: $input) {
            id
            enabled
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: restrictedKey.entity.id,
          input: { enabled: false },
        },
      },
    );

    expectNoGraphQLErrors(disabled);
    expect(disabled.body.data.updateWorkspaceApiKey.enabled).toBe(false);

    const rejectedDisabledKey = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
        }
      `,
      { bearerToken: restrictedKey.apiKey },
    );

    expect(rejectedDisabledKey.status).toBe(401);
    expect(rejectedDisabledKey.body).toMatchObject({
      message: 'API key is disabled',
      statusCode: 401,
    });
  });

  it('rejects credentials duplicated across the two API-key tables', async () => {
    const user = await createAuthenticatedUser('Ambiguous Key Owner');
    const workspace = await createWorkspace(user, 'Ambiguous Keys');
    const personal = await createUserApiKey(user, {
      name: 'Personal',
      permissions: [],
    });
    const shared = await createWorkspaceApiKey(user, workspace.id, {
      name: 'Workspace',
      permissions: [],
    });
    await migrationOrm.em
      .getConnection()
      .execute(
        'update workspace_api_key set key = (select key from user_api_key where id = ?) where id = ?',
        [personal.entity.id, shared.entity.id],
      );
    const response = await gql('query { currentUser { id } }', {
      bearerToken: personal.apiKey,
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid API key');
  });

  it('prevents workspace administrators from issuing keys above their permissions', async () => {
    const owner = await createAuthenticatedUser('Key Ceiling Owner');
    const administrator = await createAuthenticatedUser(
      'Key Ceiling Administrator',
    );
    const workspace = await createWorkspace(owner, 'Key Ceiling Workspace');
    const member = await addMember(owner, workspace.id, administrator.email);
    await setMemberRoles(owner, workspace.id, member.id, ['ADMIN']);
    await setMemberPermissions(owner, workspace.id, member.id, [
      'API_KEY__CREATE',
      'API_KEY__UPDATE',
    ]);

    const rejectedCreate = await gql(
      /* GraphQL */ `
        mutation CreateApiKey($input: CreateWorkspaceApiKeyInput!) {
          createWorkspaceApiKey(input: $input) {
            apiKey
          }
        }
      `,
      {
        cookies: administrator.cookies,
        workspaceId: workspace.id,
        variables: {
          input: {
            name: 'Escalated workspace key',
            permissions: ['WORKSPACE__DELETE'],
          },
        },
      },
    );

    expectGraphQLError(rejectedCreate);

    const key = await createWorkspaceApiKey(administrator, workspace.id, {
      name: 'Administrator workspace key',
      permissions: ['WORKSPACE__UPDATE'],
    });
    const rejectedUpdate = await gql(
      /* GraphQL */ `
        mutation UpdateApiKey($id: ID!, $input: UpdateWorkspaceApiKeyInput!) {
          updateWorkspaceApiKey(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: administrator.cookies,
        workspaceId: workspace.id,
        variables: {
          id: key.entity.id,
          input: { permissions: ['WORKSPACE__DELETE'] },
        },
      },
    );

    expectGraphQLError(rejectedUpdate);
  });

  it('validates user and workspace key prefixes through GraphQL and authenticates valid custom prefixes', async () => {
    const owner = await createAuthenticatedUser('Prefix Owner');
    const workspace = await createWorkspace(owner, 'Prefix Workspace');
    for (const prefix of [
      '1a',
      'ABC',
      'aB',
      'sk-',
      'sk_',
      'a\n',
      'a\u0000',
      'é',
      'a😀',
      'a'.repeat(33),
    ]) {
      for (const mutation of ['createWorkspaceApiKey', 'createUserApiKey']) {
        const response = await gql(
          `mutation ($input: Create${mutation === 'createUserApiKey' ? 'User' : 'Workspace'}ApiKeyInput!) { ${mutation}(input: $input) { apiKey } }`,
          {
            cookies: owner.cookies,
            workspaceId: workspace.id,
            variables: { input: { name: 'Invalid prefix', prefix } },
          },
        );
        expectGraphQLError(response);
      }
    }
    const connection = migrationOrm.em.getConnection();
    expect(
      await connection.execute(
        "select id from user_api_key where name = 'Invalid prefix' union all select id from workspace_api_key where name = 'Invalid prefix'",
      ),
    ).toEqual([]);
    const workspaceKey = await createWorkspaceApiKey(owner, workspace.id, {
      name: 'Custom workspace prefix',
      prefix: 'abc123',
      permissions: ['WORKSPACE__UPDATE'],
    });
    const personalKey = await createUserApiKey(owner, {
      name: 'Custom user prefix',
      prefix: 'a',
      permissions: [],
    });
    expectNoGraphQLErrors(
      await gql('query { currentWorkspace { id } }', {
        bearerToken: workspaceKey.apiKey,
      }),
    );
    const personal = await gql('query { currentUser { id } }', {
      bearerToken: personalKey.apiKey,
    });
    expectNoGraphQLErrors(personal);
    expect(personal.body.data.currentUser.id).toBe(owner.user.id);
  });

  it('isolates concurrent cookie, user-key, and workspace-key requests', async () => {
    const fixtures = await Promise.all(
      ['First Isolated', 'Second Isolated'].map(async (name) => {
        const owner = await createAuthenticatedUser(name);
        const workspace = await createWorkspace(owner, name);
        const userKey = await createUserApiKey(owner, {
          name: `${name} personal key`,
          permissions: ['WORKSPACE__UPDATE'],
        });
        const workspaceKey = await createWorkspaceApiKey(owner, workspace.id, {
          name: `${name} workspace key`,
          permissions: ['WORKSPACE__UPDATE'],
        });
        return { owner, workspace, userKey, workspaceKey };
      }),
    );
    const query = /* GraphQL */ `
      query {
        currentWorkspace {
          id
          name
        }
        currentMember {
          user {
            id
          }
        }
        currentWorkspace {
          members(first: 10) {
            totalCount
            edges {
              node {
                roles
              }
            }
          }
        }
      }
    `;

    for (let round = 0; round < 3; round++) {
      await Promise.all(
        fixtures.flatMap((fixture, index) => {
          const other = fixtures[1 - index];
          const identities: {
            options: GraphQLRequestOptions;
            hasUser: boolean;
          }[] = [
            {
              options: {
                cookies: fixture.owner.cookies,
                workspaceId: fixture.workspace.id,
              },
              hasUser: true,
            },
            {
              options: {
                bearerToken: fixture.userKey.apiKey,
                workspaceId: fixture.workspace.id,
              },
              hasUser: true,
            },
            {
              options: { bearerToken: fixture.workspaceKey.apiKey },
              hasUser: false,
            },
            {
              // A cookie session takes precedence over a key belonging to another workspace;
              // the explicit workspace header also takes precedence over a stale workspace cookie.
              options: {
                cookies: [
                  ...fixture.owner.cookies,
                  `workspace_id=${other.workspace.id}`,
                ],
                bearerToken: other.workspaceKey.apiKey,
                workspaceId: fixture.workspace.id,
              },
              hasUser: true,
            },
          ];
          return identities.map(async ({ options, hasUser }) => {
            const result = await gql(query, options);
            expectNoGraphQLErrors(result);
            expect(result.body.data.currentWorkspace).toMatchObject(
              fixture.workspace,
            );
            expect(result.body.data.currentMember).toEqual(
              hasUser ? { user: { id: fixture.owner.user.id } } : null,
            );
            expect(result.body.data.currentWorkspace.members).toEqual({
              totalCount: 1,
              edges: [{ node: { roles: ['OWNER'] } }],
            });
          });
        }),
      );

      const anonymous = await gql(
        'query { currentWorkspace { members(first: 10) { totalCount } } }',
      );
      expectGraphQLError(anonymous);
      expect(anonymous.body.data).toEqual({ currentWorkspace: null });
    }
  }, 20_000);

  it.each(['session', 'user-api-key'] as const)(
    'rechecks revoked permissions and disabled membership for an existing %s',
    async (authentication) => {
      const owner = await createAuthenticatedUser('Revocation Owner');
      const user = await createAuthenticatedUser('Revocation Member');
      const workspace = await createWorkspace(owner, 'Revocation Workspace');
      const member = await addMember(owner, workspace.id, user.email);
      await setMemberPermissions(owner, workspace.id, member.id, [
        'WORKSPACE__UPDATE',
      ]);
      const identity: GraphQLRequestOptions =
        authentication === 'session'
          ? { cookies: user.cookies }
          : {
              bearerToken: (
                await createUserApiKey(user, {
                  name: 'Revocable personal key',
                  permissions: ['WORKSPACE__UPDATE'],
                })
              ).apiKey,
            };
      const rename = (name: string) =>
        gql(
          'mutation ($workspaceId: ID!, $input: UpdateWorkspaceInput!) { updateWorkspace(id: $workspaceId, input: $input) { id } }',
          {
            ...identity,
            workspaceId: workspace.id,
            variables: { input: { name } },
          },
        );
      const allowed = await rename('Allowed before revocation');
      expectNoGraphQLErrors(allowed);
      expect(allowed.body.data.updateWorkspace).toEqual({ id: workspace.id });
      expect(
        await migrationOrm.em.execute(
          'select name from workspace where id = ?',
          [workspace.id],
        ),
      ).toEqual([{ name: 'Allowed before revocation' }]);

      await setMemberPermissions(owner, workspace.id, member.id, []);
      const revoked = await rename('Denied after revocation');
      expectGraphQLError(revoked);
      expect(revoked.body.data).toBeNull();
      expect(revoked.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      ]);

      await setMemberPermissions(owner, workspace.id, member.id, [
        'WORKSPACE__UPDATE',
      ]);
      expectNoGraphQLErrors(await rename('Allowed after regrant'));
      const disabled = await gql(
        'mutation ($id: ID!, $input: UpdateMemberInput!) { updateMember(id: $id, input: $input) { id } }',
        {
          cookies: owner.cookies,
          workspaceId: workspace.id,
          variables: { id: member.id, input: { status: 'DISABLED' } },
        },
      );
      expectNoGraphQLErrors(disabled);
      const rejected = await rename('Denied after membership disabled');
      expectGraphQLError(rejected);
      expect(rejected.body.data).toBeNull();
      expect(rejected.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      ]);
      const profile = await gql('query { currentUser { id } }', identity);
      expectNoGraphQLErrors(profile);
      expect(profile.body.data.currentUser.id).toBe(user.user.id);
      expect(
        await migrationOrm.em
          .getConnection()
          .execute('select name from workspace where id = ?', [workspace.id]),
      ).toEqual([{ name: 'Allowed after regrant' }]);
    },
    20_000,
  );

  it.each(['header', 'cookie'] as const)(
    'rejects a workspace key selecting a different workspace through a %s',
    async (selection) => {
      const owner = await createAuthenticatedUser('Scoped Key Owner');
      const workspace = await createWorkspace(owner, 'Key Workspace');
      const otherWorkspace = await createWorkspace(
        owner,
        'Other Key Workspace',
      );
      const key = await createWorkspaceApiKey(owner, workspace.id, {
        name: 'Workspace-bound key',
        permissions: ['WORKSPACE__UPDATE'],
      });
      const query = 'query { currentWorkspace { id name } }';
      const rejected = await gql(query, {
        bearerToken: key.apiKey,
        ...(selection === 'header'
          ? { workspaceId: otherWorkspace.id }
          : { cookies: [`workspace_id=${otherWorkspace.id}`] }),
      });
      expect(rejected.status).toBe(401);
      expect(rejected.body).toMatchObject({
        message: 'Workspace API key does not belong to the selected workspace',
      });
      expect(rejected.body.data).toBeUndefined();
      const allowed = await gql(query, { bearerToken: key.apiKey });
      expectNoGraphQLErrors(allowed);
      expect(allowed.body.data.currentWorkspace).toEqual(workspace);
    },
  );

  async function raceWithWorkspaceLock(
    workspaceId: string,
    operations: (() => PromiseLike<request.Response>)[],
  ) {
    const connection = migrationOrm.em.getConnection();
    const requests: Promise<request.Response>[] = [];
    try {
      await connection.transactional(async (transaction) => {
        await connection.execute(
          'select id from workspace where id = ? for update',
          [workspaceId],
          'all',
          transaction,
        );
        for (const operation of operations) {
          requests.push(Promise.resolve(operation()));
          await vi.waitFor(
            async () => {
              const [waiting] = await connection.execute<{ count: number }[]>(
                `select count(*)::int as count from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%"workspace"%'`,
              );
              expect(waiting.count).toBe(requests.length);
            },
            { timeout: 5000, interval: 20 },
          );
        }
      });
      return await Promise.all(requests);
    } finally {
      await Promise.allSettled(requests);
    }
  }

  async function createAuthenticatedUser(
    name: string,
    email = uniqueEmail(name),
  ): Promise<AuthenticatedUser> {
    const password = 'correct-horse-battery-staple';

    const registered = await signUpWithEmail({ name, email, password });

    expect(registered.status).toBe(200);
    await verifyEmail(email);

    const loggedIn = await signInWithEmail({ email, password });
    const cookies = collectSetCookies(loggedIn);

    expect(loggedIn.status).toBe(200);
    expect(cookies.length).toBeGreaterThan(0);

    return {
      cookies,
      email,
      password,
      user: loggedIn.body.user,
    };
  }

  it.each([false, true])(
    'creates an ID-only workspace payload with an existing selection: %s',
    async (selected) => {
      const owner = await createAuthenticatedUser('Workspace payload owner');
      const original = selected
        ? await createWorkspace(owner, 'Original workspace')
        : null;
      const response = await gql(
        `mutation {
          createWorkspace(input: { name: "Payload workspace" }) { __typename id }
          ${original ? `updateWorkspace(id: "${original.id}", input: { name: "Original after create" }) { id }` : ''}
        }`,
        {
          cookies: owner.cookies,
          ...(original ? { workspaceId: original.id } : {}),
        },
      );
      expectNoGraphQLErrors(response);
      expect(response.body.data.createWorkspace).toEqual({
        __typename: 'CreateWorkspacePayload',
        id: expect.any(String),
      });
      if (original) {
        expect(response.body.data.updateWorkspace).toEqual({
          id: original.id,
        });
        expect(
          await migrationOrm.em.execute(
            'select name from workspace where id = ?',
            [original.id],
          ),
        ).toEqual([{ name: 'Original after create' }]);
      }
      const id = response.body.data.createWorkspace.id as string;
      const lookup = await gql(
        'query { currentWorkspace { id name members(first: 1) { edges { node { id } } } } }',
        { cookies: owner.cookies, workspaceId: id },
      );
      expectNoGraphQLErrors(lookup);
      expect(lookup.body.data.currentWorkspace).toMatchObject({
        id,
        name: 'Payload workspace',
      });
      expect(lookup.body.data.currentWorkspace.members.edges).toHaveLength(1);
    },
  );

  async function createWorkspace(
    user: AuthenticatedUser,
    name: string,
  ): Promise<WorkspaceFixture> {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateWorkspace($input: CreateWorkspaceInput!) {
          createWorkspace(input: $input) {
            id
          }
        }
      `,
      {
        cookies: user.cookies,
        variables: {
          input: {
            name,
          },
        },
      },
    );

    expectNoGraphQLErrors(response);

    expect(response.body.data.createWorkspace).toEqual({
      id: expect.any(String),
    });
    return { id: response.body.data.createWorkspace.id, name };
  }

  it('rejects invitations to an existing login identity despite private or stale member profiles', async () => {
    const owner = await createAuthenticatedUser('Invitation owner');
    const target = await createAuthenticatedUser('Existing invitee');
    const workspace = await createWorkspace(owner, 'Invitation identity');
    const member = await addMember(owner, workspace.id, target.email);
    const loginEmail = uniqueEmail('Changed login');
    const connection = migrationOrm.em.getConnection();
    await connection.execute('update "user" set email = ? where id = ?', [
      loginEmail,
      target.user.id,
    ]);

    // Workspace ownership does not grant access to the user's private profile.
    const hidden = await gql(
      'query ($id: ID!) { member(id: $id) { user { id email } } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: { id: member.id },
      },
    );
    expectGraphQLError(hidden);
    expect(hidden.body.data.member.user).toBeNull();

    for (const [email, status] of [
      [target.email, 'ACTIVE'],
      [null, 'DISABLED'],
    ] as const) {
      expectNoGraphQLErrors(
        await gql(
          'mutation ($id: ID!, $input: UpdateMemberInput!) { updateMember(id: $id, input: $input) { id } }',
          {
            cookies: owner.cookies,
            workspaceId: workspace.id,
            variables: { id: member.id, input: { email, status } },
          },
        ),
      );
      const rejected = await gql(
        'mutation ($input: CreateInvitationInput!) { createInvitation(input: $input) { id } }',
        {
          cookies: owner.cookies,
          workspaceId: workspace.id,
          variables: {
            input: { email: loginEmail.toUpperCase(), roles: ['MEMBER'] },
          },
        },
      );
      expect(rejected.body.errors).toEqual([
        expect.objectContaining({ message: 'User is already a member' }),
      ]);
    }
    expect(
      await connection.execute(
        'select id from invitation where workspace_id = ?',
        [workspace.id],
      ),
    ).toEqual([]);
  });

  it.each([false, true])(
    'accepts an invitation when its email is only another member contact address (registered: %s)',
    async (registered) => {
      const owner = await createAuthenticatedUser('Contact collision owner');
      const workspace = await createWorkspace(owner, 'Contact collision');
      const email = uniqueEmail('Contact collision invitee');
      let invitee = registered
        ? await createAuthenticatedUser('Registered invitee', email)
        : null;
      if (invitee) await createWorkspace(invitee, 'Different membership');
      const connection = migrationOrm.em.getConnection();
      await connection.execute(
        'update member set email = ? where workspace_id = ? and user_id = ?',
        [email, workspace.id, owner.user.id],
      );
      const invitation = await createInvitation(owner, workspace.id, {
        email,
        roles: ['MEMBER'],
      });
      if (!invitee) {
        expect(
          await connection.execute('select id from "user" where email = ?', [
            email,
          ]),
        ).toEqual([]);
        invitee = await createAuthenticatedUser('New invitee', email);
      }
      const accepted = await gql(
        'mutation ($invitationId: ID!) { acceptInvitation(id: $invitationId) { id memberId workspaceId } }',
        {
          cookies: invitee.cookies,
          variables: { invitationId: invitation.id },
        },
      );
      expectNoGraphQLErrors(accepted);
      expect(accepted.body.data.acceptInvitation).toEqual({
        id: invitation.id,
        memberId: expect.any(String),
        workspaceId: workspace.id,
      });
      expect(
        await connection.execute('select email from member where id = ?', [
          accepted.body.data.acceptInvitation.memberId,
        ]),
      ).toEqual([{ email }]);
      expect(
        await connection.execute('select status from invitation where id = ?', [
          invitation.id,
        ]),
      ).toEqual([{ status: 'accepted' }]);
      // Editing a contact address must allow sharing another member's email too.
      for (const contactEmail of [null, email.toUpperCase()]) {
        const updated = await gql(
          'mutation ($id: ID!, $input: UpdateMemberInput!) { updateMember(id: $id, input: $input) { id } }',
          {
            cookies: owner.cookies,
            workspaceId: workspace.id,
            variables: {
              id: accepted.body.data.acceptInvitation.memberId,
              input: { email: contactEmail },
            },
          },
        );
        expectNoGraphQLErrors(updated);
        expect(
          await connection.execute('select email from member where id = ?', [
            updated.body.data.updateMember.id,
          ]),
        ).toEqual([{ email: contactEmail === null ? null : email }]);
      }
      const members = await connection.execute<{ user_id: string }[]>(
        'select user_id from member where workspace_id = ?',
        [workspace.id],
      );
      expect(members.map((member) => member.user_id).sort()).toEqual(
        [owner.user.id, invitee.user.id].sort(),
      );
    },
  );

  it('shares member profiles without exposing or synchronizing private user profiles', async () => {
    const owner = await createAuthenticatedUser('Profile owner');
    const user = await createAuthenticatedUser('Original member profile');
    const peer = await createAuthenticatedUser('Workspace peer');
    const workspace = await createWorkspace(owner, 'Profile workspace');
    const member = await addMember(owner, workspace.id, user.email);
    await addMember(owner, workspace.id, peer.email);
    expectNoGraphQLErrors(
      await gql(
        'mutation { updateCurrentUser(input: { name: "Private renamed profile" }) }',
        { cookies: user.cookies },
      ),
    );
    const update = await gql(
      'mutation ($id: ID!, $input: UpdateMemberInput!) { updateMember(id: $id, input: $input) { id } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: member.id,
          input: {
            name: 'Shared member profile',
            email: 'team-contact@example.test',
          },
        },
      },
    );
    expectNoGraphQLErrors(update);
    const query = `query ($query: String) {
      currentWorkspace { members(first: 10, query: $query) {
        totalCount edges { node { id name email } }
      } }
    }`;
    for (const viewer of [owner, peer]) {
      const options = { cookies: viewer.cookies, workspaceId: workspace.id };
      const visible = await gql(query, {
        ...options,
        variables: { query: 'Shared*' },
      });
      expectNoGraphQLErrors(visible);
      expect(visible.body.data.currentWorkspace.members).toEqual({
        totalCount: 1,
        edges: [
          {
            node: {
              id: member.id,
              name: 'Shared member profile',
              email: 'team-contact@example.test',
            },
          },
        ],
      });
      for (const search of ['Private*', user.email]) {
        const hidden = await gql(query, {
          ...options,
          variables: { query: search },
        });
        expectNoGraphQLErrors(hidden);
        expect(hidden.body.data.currentWorkspace.members.totalCount).toBe(0);
      }
      const hiddenUser = await gql(
        'query ($id: ID!) { member(id: $id) { name email user { name email } } }',
        { ...options, variables: { id: member.id } },
      );
      expectGraphQLError(hiddenUser);
      expect(hiddenUser.body.data.member.user).toBeNull();
      expect(hiddenUser.body.data.member.name).toBe('Shared member profile');
    }
    const ownProfile = await gql('query { currentUser { name email } }', {
      cookies: user.cookies,
    });
    expectNoGraphQLErrors(ownProfile);
    expect(ownProfile.body.data.currentUser).toEqual({
      name: 'Private renamed profile',
      email: user.email,
    });

    const foreign = await createWorkspace(owner, 'Other workspace');
    const invisibleMember = await gql(
      'query ($id: ID!) { member(id: $id) { name email } }',
      {
        cookies: owner.cookies,
        workspaceId: foreign.id,
        variables: { id: member.id },
      },
    );
    expectNoGraphQLErrors(invisibleMember);
    expect(invisibleMember.body.data.member).toBeNull();

    await migrationOrm.em
      .getConnection()
      .execute(
        'update "user" set permissions = array[\'user:get\']::text[] where id = ?',
        [owner.user.id],
      );
    const administrator = await gql(
      'query ($id: ID!) { member(id: $id) { user { name email } } }',
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: { id: member.id },
      },
    );
    expectNoGraphQLErrors(administrator);
    expect(administrator.body.data.member.user).toEqual({
      name: 'Private renamed profile',
      email: user.email,
    });
  });

  it('rejects invalid update fields before persistence while allowing omission', async () => {
    const owner = await createAuthenticatedUser('Nullable Input Owner');
    const user = await createAuthenticatedUser('Nullable Input Member');
    const workspace = await createWorkspace(owner, 'Nullable Inputs');
    const member = await addMember(owner, workspace.id, user.email);
    const connection = migrationOrm.em.getConnection();
    await connection.execute(
      `update "user" set roles = array['admin'] where id = ?`,
      [owner.user.id],
    );

    for (const [operation, inputType, id, field, sql] of [
      [
        'updateUser',
        'UpdateUserInput',
        user.user.id,
        'email',
        'select email from "user" where id = ?',
      ],
      [
        'updateWorkspace',
        'UpdateWorkspaceInput',
        workspace.id,
        'name',
        'select name from workspace where id = ?',
      ],
      [
        'updateMember',
        'UpdateMemberInput',
        member.id,
        'status',
        'select status from member where id = ?',
      ],
      [
        'updateUser',
        'UpdateUserInput',
        user.user.id,
        'name',
        'select name from "user" where id = ?',
      ],
      [
        'updateMember',
        'UpdateMemberInput',
        member.id,
        'name',
        'select name from member where id = ?',
      ],
    ] as const) {
      const mutate = (input: Record<string, unknown>) =>
        gql(
          `mutation($id: ID!, $input: ${inputType}!) { ${operation}(id: $id, input: $input) { id } }`,
          {
            cookies: owner.cookies,
            workspaceId: workspace.id,
            variables: { id, input },
          },
        );
      const before = await connection.execute(sql, [id]);
      const invalidValues =
        field === 'name' ? [null, '', ' \n\t ', 'x'.repeat(256)] : [null];
      for (const invalid of invalidValues) {
        const rejected = await mutate({ [field]: invalid });
        expect(rejected.body.errors).toEqual([
          expect.objectContaining({
            extensions: expect.objectContaining({
              code: 'BAD_USER_INPUT',
              validationErrors: expect.arrayContaining([
                expect.objectContaining({ field: [field] }),
              ]),
            }),
          }),
        ]);
        expect(await connection.execute(sql, [id])).toEqual(before);
      }

      expectNoGraphQLErrors(await mutate({}));
      expect(await connection.execute(sql, [id])).toEqual(before);
      if (field === 'name') {
        expectNoGraphQLErrors(await mutate({ name: '  Trimmed name  ' }));
        expect(await connection.execute(sql, [id])).toEqual([
          { name: 'Trimmed name' },
        ]);
      }
    }

    for (const query of [
      'mutation($id: ID!) { banUser(id: $id, input: null) { id } }',
      'mutation { deleteCurrentUser(input: null) { success } }',
    ]) {
      const rejected = await gql(query, {
        cookies: owner.cookies,
        variables: { id: user.user.id },
      });
      expect(rejected.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }),
        }),
      ]);
    }
    expect(
      await connection.execute('select banned from "user" where id = ?', [
        user.user.id,
      ]),
    ).toEqual([{ banned: false }]);
    expect(
      await connection.execute('select id from "user" where id = ?', [
        owner.user.id,
      ]),
    ).toEqual([{ id: owner.user.id }]);
    const banned = await gql('mutation($id: ID!) { banUser(id: $id) { id } }', {
      cookies: owner.cookies,
      variables: { id: user.user.id },
    });
    expectNoGraphQLErrors(banned);
    expect(banned.body.data.banUser).toEqual({ id: user.user.id });
    expect(
      await connection.execute('select banned from "user" where id = ?', [
        user.user.id,
      ]),
    ).toEqual([{ banned: true }]);
  });

  async function addMember(
    user: AuthenticatedUser,
    workspaceId: string,
    email: string,
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation AddMember($input: AddMemberInput!) {
          addMember(input: $input) {
            id
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: {
          input: {
            email,
          },
        },
      },
    );

    expectNoGraphQLErrors(response);

    return await readMember(user, workspaceId, response.body.data.addMember.id);
  }

  async function readMember(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
  ) {
    const response = await gql(
      'query ($id: ID!) { member(id: $id) { id roles permissions status name email } }',
      { cookies: user.cookies, workspaceId, variables: { id } },
    );
    expectNoGraphQLErrors(response);
    return response.body.data.member as {
      id: string;
      roles: string[];
      permissions: string[];
      status: string;
      name: string;
      email: string | null;
    };
  }

  async function setMemberRoles(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
    roles: string[],
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation SetMemberRoles($id: ID!, $input: SetMemberRolesInput!) {
          setMemberRoles(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: { id, input: { roles } },
      },
    );

    expectNoGraphQLErrors(response);
    return await readMember(user, workspaceId, id);
  }

  async function setMemberPermissions(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
    permissions: string[],
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation SetMemberPermissions(
          $id: ID!
          $input: SetMemberPermissionsInput!
        ) {
          setMemberPermissions(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: { id, input: { permissions } },
      },
    );

    expectNoGraphQLErrors(response);
    return await readMember(user, workspaceId, id);
  }

  async function createInvitation(
    user: AuthenticatedUser,
    workspaceId: string,
    input: { email: string; roles: string[] },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateInvitation($input: CreateInvitationInput!) {
          createInvitation(input: $input) {
            id
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: {
          input,
        },
      },
    );

    expectNoGraphQLErrors(response);

    const lookup = await gql(
      'query ($id: ID!) { invitation(id: $id) { id email expiresAt roles status } }',
      {
        cookies: user.cookies,
        workspaceId,
        variables: { id: response.body.data.createInvitation.id },
      },
    );
    expectNoGraphQLErrors(lookup);
    return lookup.body.data.invitation as {
      id: string;
      email: string;
      expiresAt: string;
      roles: string[];
      status: string;
    };
  }

  async function createWorkspaceApiKey(
    user: AuthenticatedUser,
    workspaceId: string,
    input: {
      expiresAt?: string;
      name: string;
      permissions?: string[];
      prefix?: string;
    },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateApiKey($input: CreateWorkspaceApiKeyInput!) {
          createWorkspaceApiKey(input: $input) {
            apiKey
            entity {
              id
              name
              enabled
              permissions
              prefix
              start
            }
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: {
          input,
        },
      },
    );

    expectNoGraphQLErrors(response);
    expect(response.body.data.createWorkspaceApiKey.apiKey).toMatch(
      new RegExp(`^${input.prefix ?? 'sk'}[A-Za-z0-9_-]{64}$`),
    );
    expect(response.body.data.createWorkspaceApiKey.entity).toMatchObject({
      enabled: true,
      permissions: input.permissions ?? [],
      prefix: input.prefix ?? 'sk',
      start: response.body.data.createWorkspaceApiKey.apiKey.slice(0, 8),
    });

    return response.body.data.createWorkspaceApiKey as {
      apiKey: string;
      entity: {
        id: string;
        name: string;
        enabled: boolean;
        permissions: string[];
        prefix: string;
        start: string;
      };
    };
  }

  async function createUserApiKey(
    user: AuthenticatedUser,
    input: {
      expiresAt?: string;
      name: string;
      permissions?: string[];
      prefix?: string;
    },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateUserApiKey($input: CreateUserApiKeyInput!) {
          createUserApiKey(input: $input) {
            apiKey
            entity {
              id
              name
              enabled
              permissions
              prefix
              start
            }
          }
        }
      `,
      {
        cookies: user.cookies,
        variables: { input },
      },
    );

    expectNoGraphQLErrors(response);
    expect(response.body.data.createUserApiKey.apiKey).toMatch(
      new RegExp(`^${input.prefix ?? 'sk'}[A-Za-z0-9_-]{64}$`),
    );
    return response.body.data.createUserApiKey as {
      apiKey: string;
      entity: {
        id: string;
        name: string;
      };
    };
  }

  function gql(query: string, options: GraphQLRequestOptions = {}) {
    const req = request(baseUrl)
      .post('/api/graphql')
      .send({
        query,
        variables: { workspaceId: options.workspaceId, ...options.variables },
      });

    if (options.cookies) {
      req.set('Cookie', toCookieHeader(options.cookies));
    }

    if (options.workspaceId) {
      req.set('x-workspace-id', options.workspaceId);
    }

    if (options.bearerToken) {
      req.set('Authorization', `Bearer ${options.bearerToken}`);
    }

    return req;
  }

  function signUpWithEmail(input: EmailSignUpInput) {
    return request(baseUrl).post('/api/auth/sign-up/email').send(input);
  }

  function signInWithEmail(input: EmailSignInInput) {
    return request(baseUrl).post('/api/auth/sign-in/email').send(input);
  }

  async function verifyEmail(email: string): Promise<void> {
    const verificationUrl = await waitForEmailUrl(
      email,
      'Verify your email address',
    );
    const url = new URL(verificationUrl);
    const response = await request(baseUrl).get(`${url.pathname}${url.search}`);

    expect(response.status).toBe(302);
  }
});

interface EmailSignInInput {
  email: string;
  password: string;
}

interface EmailSignUpInput extends EmailSignInInput {
  name: string;
}

interface GraphQLRequestOptions {
  bearerToken?: string;
  cookies?: string[];
  workspaceId?: string;
  variables?: Record<string, unknown>;
}

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: {
    Address: string;
  }[];
}

interface MailpitMessagesResponse {
  messages: MailpitMessageSummary[];
}

interface MailpitMessage {
  Text: string;
}

function uniqueEmail(seed: string) {
  const normalizedSeed = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  uniqueCounter += 1;

  return `${normalizedSeed}-${process.pid}-${Date.now()}-${uniqueCounter}@example.com`;
}

async function waitForEmailUrl(
  email: string,
  subject: string,
): Promise<string> {
  const timeoutAt = Date.now() + 5_000;

  while (Date.now() < timeoutAt) {
    const messagesResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    if (!messagesResponse.ok) {
      throw new Error(`Mailpit returned ${messagesResponse.status}`);
    }

    const { messages } =
      (await messagesResponse.json()) as MailpitMessagesResponse;
    const message = messages.find(
      (candidate) =>
        candidate.Subject === subject &&
        candidate.To.some((recipient) => recipient.Address === email),
    );

    if (message) {
      const messageResponse = await fetch(
        `${mailpitUrl}/api/v1/message/${message.ID}`,
      );
      if (!messageResponse.ok) {
        throw new Error(`Mailpit returned ${messageResponse.status}`);
      }

      const { Text: text } = (await messageResponse.json()) as MailpitMessage;
      const match = /https?:\/\/\S+/u.exec(text);
      if (match?.[0]) return match[0];
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`${subject} email was not received for ${email}`);
}

function collectSetCookies(response: request.Response) {
  return collectRawSetCookies(response).map((cookie) => cookie.split(';')[0]);
}

function collectRawSetCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  return header ? (Array.isArray(header) ? header : [header]) : [];
}

function expectNoGraphQLErrors(response: request.Response) {
  expect(response.body.errors).toBeUndefined();
}

function expectGraphQLError(response: request.Response) {
  expect(response.body.errors).toEqual(expect.any(Array));
  expect(response.body.errors.length).toBeGreaterThan(0);
}

function toCookieHeader(cookies: string[]) {
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function applyMigrations(orm: AdminOrm) {
  const migrationFiles = (
    await readdir(`${process.cwd()}/src/database/migrations`)
  )
    .filter((file) => /^Migration.*\.ts$/.test(file))
    .sort();

  for (const file of migrationFiles) {
    const migrationModule = await import(
      pathToFileURL(`${process.cwd()}/src/database/migrations/${file}`).href
    );
    const Migration = Object.values(migrationModule).find(
      (value) =>
        typeof value === 'function' && value.name.startsWith('Migration'),
    ) as MigrationConstructor | undefined;

    if (!Migration) {
      throw new Error(`Migration class not found in ${file}`);
    }

    const migration = new Migration();

    await migration.up();

    for (const statement of migration.getQueries()) {
      await orm.em.getConnection().execute(statement);
    }
  }
}

async function createDatabase() {
  const orm = await adminOrm(adminDatabaseUrl);

  try {
    await orm.em
      .getConnection()
      .execute(`CREATE DATABASE "${databaseName}" WITH ENCODING 'UTF8'`);
  } finally {
    await orm.close(true);
  }
}

async function dropDatabase() {
  const orm = await adminOrm(adminDatabaseUrl);

  try {
    await orm.em.getConnection().execute(
      /* SQL */ `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ?;
      `,
      [databaseName],
    );
    await orm.em
      .getConnection()
      .execute(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await orm.close(true);
  }
}

function adminOrm(clientUrl: string) {
  return MikroORM.init({
    driver: PostgreSqlDriver,
    clientUrl,
    entities: [DbProbeSchema],
    allowGlobalContext: true,
  });
}

function databaseUrlFor(name: string) {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${name}`;

  return url.toString();
}

function setTestEnv() {
  for (const key of envKeys) {
    oldEnv.set(key, process.env[key]);
  }

  process.env.NODE_ENV = 'testing';
  delete process.env.DB_URL;
  process.env.DATABASE_URL = databaseUrl;
  process.env.APP_URL = 'http://127.0.0.1';
  process.env.AUTH_URL = 'http://127.0.0.1';
  process.env.APP_SECRET = '1oAdy3zpD3S0t1AdAqPTlj4Hhkyx83pT2UlNGfS4P2c';
  process.env.AUTH_SECRET = 'R4vWrEDXeeor7VzGzQsdbQobOFtv2nRrlhOVTGpOteA';
  process.env.AUTH_GITHUB_ENABLED = 'true';
  process.env.AUTH_GITHUB_CLIENT_ID = 'github-client-id';
  process.env.AUTH_GITHUB_CLIENT_SECRET = 'github-client-secret';
  process.env.AUTH_OIDC_ENABLED = 'false';
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '31025';
}

function restoreEnv() {
  for (const [key, value] of oldEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  oldEnv.clear();
}

function createServerEnv() {
  const env = { ...process.env };

  delete env.NODE_OPTIONS;
  delete env.JEST_WORKER_ID;
  delete env.TS_NODE_COMPILER_OPTIONS;
  delete env.TS_NODE_PROJECT;
  delete env.TS_JEST;
  delete env.VITEST;
  delete env.VITEST_POOL_ID;
  delete env.VITEST_WORKER_ID;

  return env;
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close(() => {
          reject(new Error('Unable to allocate a port'));
        });
        return;
      }

      const { port } = address;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

async function waitForServer(
  baseUrl: string,
  serverProcess: ChildProcessWithoutNullStreams,
  getServerOutput: () => string,
) {
  const timeoutAt = Date.now() + 20_000;
  let lastError: unknown;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/ok`);

      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(
        `Server exited before becoming ready:\n${getServerOutput()}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Server did not become ready: ${formatUnknownError(lastError)}\n${getServerOutput()}`,
  );
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error) ?? 'unknown error';
}

async function stopServer(serverProcess: ChildProcessWithoutNullStreams) {
  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    serverProcess.once('exit', () => {
      resolve();
    });
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (
        serverProcess.exitCode === null &&
        serverProcess.signalCode === null
      ) {
        serverProcess.kill('SIGKILL');
      }
    }, 5_000).unref();
  });
}
