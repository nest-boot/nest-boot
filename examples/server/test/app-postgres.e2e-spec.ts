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

  it('supports email authentication through GraphQL with cookie sessions', async () => {
    const email = uniqueEmail('graphql-auth');
    const password = 'correct-horse-battery-staple';
    const registered = await gql(
      /* GraphQL */ `
        mutation SignUp($input: AuthSignUpInput!) {
          authSignUp(input: $input) {
            token
            user {
              id
              name
              email
            }
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
    expect(registered.body.data.authSignUp).toMatchObject({
      token: null,
      user: { email, name: 'GraphQL User' },
    });
    await verifyEmail(email);

    const loggedIn = await gql(
      /* GraphQL */ `
        mutation SignIn($input: AuthSignInInput!) {
          authSignIn(input: $input) {
            token
            user {
              id
              email
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
    expect(loggedIn.body.data.authSignIn.user.email).toBe(email);
    expect(cookies.length).toBeGreaterThan(0);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/(?:max-age|expires)=/iu);

    const otherLogin = await signInWithEmail({ email, password });
    const otherCookies = collectSetCookies(otherLogin);
    const listedSessions = await gql(
      /* GraphQL */ `
        query {
          authSessions {
            id
            token
            current
            ipAddress
            userAgent
            createdAt
            expiresAt
          }
        }
      `,
      { cookies },
    );

    expectNoGraphQLErrors(listedSessions);
    expect(listedSessions.body.data.authSessions).toHaveLength(2);
    expect(
      listedSessions.body.data.authSessions.filter(
        (session: { current: boolean }) => session.current,
      ),
    ).toHaveLength(1);
    const otherSession = listedSessions.body.data.authSessions.find(
      (session: { current: boolean }) => !session.current,
    );
    expect(otherSession?.token).toBeTypeOf('string');

    const revokedSession = await gql(
      /* GraphQL */ `
        mutation RevokeSession($token: String!) {
          authRevokeSession(token: $token)
        }
      `,
      {
        cookies,
        variables: { token: otherSession.token },
      },
    );

    expectNoGraphQLErrors(revokedSession);
    expect(revokedSession.body.data.authRevokeSession).toBe(true);
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
          authChangePassword(input: $input) {
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
    expect(passwordChanged.body.data.authChangePassword.token).toBeTypeOf(
      'string',
    );
    expect(replacementCookies.length).toBeGreaterThan(0);
    expect((await signInWithEmail({ email, password })).status).toBe(401);
    expect(
      (await signInWithEmail({ email, password: changedPassword })).status,
    ).toBe(200);

    const passwordResetRequested = await gql(
      /* GraphQL */ `
        mutation RequestPasswordReset($input: AuthRequestPasswordResetInput!) {
          authRequestPasswordReset(input: $input) {
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
    expect(
      passwordResetRequested.body.data.authRequestPasswordReset.status,
    ).toBe(true);

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
          authResetPassword(input: $input)
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
    expect(passwordReset.body.data.authResetPassword).toBe(true);
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
          authSignOut
        }
      `,
      { cookies: collectSetCookies(resetPasswordLogin) },
    );

    expectNoGraphQLErrors(signedOut);
    expect(signedOut.body.data.authSignOut).toBe(true);
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
          authChangeEmail(input: $input)
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
    expect(changeRequested.body.data.authChangeEmail).toBe(true);

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
            name
            permissions
          }
          userPermissions
        }
      `,
      { cookies: administrator.cookies },
    );

    expectNoGraphQLErrors(catalog);
    expect(catalog.body.data.userRoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'admin' }),
        expect.objectContaining({ name: 'user' }),
      ]),
    );
    expect(catalog.body.data.userPermissions).toContain('user:set-role');

    const assigned = await gql(
      /* GraphQL */ `
        mutation SetUserRoles($id: ID!, $input: SetUserRolesInput!) {
          setUserRoles(id: $id, input: $input) {
            id
            roles
          }
        }
      `,
      {
        cookies: administrator.cookies,
        variables: {
          id: target.user.id,
          input: { roles: ['admin'] },
        },
      },
    );

    expectNoGraphQLErrors(assigned);
    expect(assigned.body.data.setUserRoles).toEqual({
      id: target.user.id,
      roles: ['admin'],
    });
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
          currentWorkspaceMember {
            id
            roles
            type
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
    expect(fromHeader.body.data.currentWorkspaceMember).toMatchObject({
      roles: ['owner'],
      type: 'USER',
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
          currentWorkspaceMember {
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
    expect(fromCookie.body.data.currentWorkspaceMember.roles).toEqual([
      'owner',
    ]);

    const crossWorkspace = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentWorkspaceMember {
            id
          }
        }
      `,
      { cookies: alice.cookies, workspaceId: bobWorkspace.id },
    );

    expectNoGraphQLErrors(crossWorkspace);
    expect(crossWorkspace.body.data.currentWorkspace).toEqual(bobWorkspace);
    expect(crossWorkspace.body.data.currentWorkspaceMember).toBeNull();

    const withoutWorkspace = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
          currentWorkspaceMember {
            id
          }
        }
      `,
      { cookies: alice.cookies },
    );

    expectNoGraphQLErrors(withoutWorkspace);
    expect(withoutWorkspace.body.data.currentWorkspace).toBeNull();
    expect(withoutWorkspace.body.data.currentWorkspaceMember).toBeNull();

    const aliceWorkspaces = await gql(
      /* GraphQL */ `
        query {
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
      `,
      { cookies: alice.cookies, workspaceId: aliceWorkspace.id },
    );

    expectNoGraphQLErrors(aliceWorkspaces);
    expect(aliceWorkspaces.body.data.workspaces).toMatchObject({
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
      `,
      { cookies: user.cookies, workspaceId: firstWorkspace.id },
    );

    expectNoGraphQLErrors(response);
    expect(response.body.data.workspaces.totalCount).toBe(2);
    expect(response.body.data.workspaces.edges).toEqual(
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
    const member = await addWorkspaceMember(
      owner,
      workspace.id,
      memberUser.email,
    );

    const rejectedMemberUpdate = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspace($input: UpdateWorkspaceInput!) {
          updateWorkspace(input: $input) {
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

    await updateWorkspaceMemberRole(owner, workspace.id, member.id, ['admin']);

    const updatedByAdmin = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspace($input: UpdateWorkspaceInput!) {
          updateWorkspace(input: $input) {
            id
            name
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
      name: 'Renamed Lifecycle Workspace',
    });

    const rejectedAdminDelete = await gql(
      /* GraphQL */ `
        mutation {
          deleteWorkspace {
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
        mutation {
          deleteWorkspace {
            id
            deletedAt
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
      deletedAt: expect.any(String),
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

  it('manages members, invite acceptance, and member removal through real auth', async () => {
    const owner = await createAuthenticatedUser('Member Owner');
    const memberUser = await createAuthenticatedUser('Member Target');
    const invitee = await createAuthenticatedUser('Invite Target');
    const wrongInvitee = await createAuthenticatedUser('Wrong Invite Target');
    const workspace = await createWorkspace(owner, 'Member Workspace');
    const member = await addWorkspaceMember(
      owner,
      workspace.id,
      memberUser.email,
    );

    const roleCatalog = await gql(
      /* GraphQL */ `
        query WorkspaceRoleCatalog {
          workspaceRoles {
            name
            permissions
          }
          workspacePermissions
        }
      `,
      { cookies: owner.cookies, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(roleCatalog);
    expect(roleCatalog.body.data.workspaceRoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'owner' }),
        expect.objectContaining({ name: 'admin' }),
        expect.objectContaining({ name: 'member' }),
      ]),
    );
    expect(roleCatalog.body.data.workspacePermissions).toContain(
      'workspaceMember:update',
    );

    const currentMember = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
            id
            roles
            status
            type
            user {
              email
            }
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(currentMember);
    expect(currentMember.body.data.currentWorkspaceMember).toMatchObject({
      id: member.id,
      roles: ['member'],
      status: 'ACTIVE',
      type: 'USER',
      user: {
        email: memberUser.email,
      },
    });

    const updatedMember = await setWorkspaceMemberPermissions(
      owner,
      workspace.id,
      member.id,
      ['workspace:update', 'workspaceMember:update'],
    );

    expect(updatedMember.permissions).toEqual([
      'workspace:update',
      'workspaceMember:update',
    ]);

    const memberPermissions = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
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
    expect(memberPermissions.body.data.currentWorkspaceMember).toEqual({
      permissions: ['workspace:update', 'workspaceMember:update'],
    });

    const rejectedMemberAdd = await gql(
      /* GraphQL */ `
        mutation AddWorkspaceMember($input: AddWorkspaceMemberInput!) {
          addWorkspaceMember(input: $input) {
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

    const invite = await createWorkspaceInvitation(owner, workspace.id, {
      email: invitee.email,
      roles: ['member'],
    });

    const invitationById = await gql(
      /* GraphQL */ `
        query WorkspaceInvitation($id: ID!) {
          workspaceInvitation(id: $id) {
            id
            email
            roles
            status
            expiresAt
            inviter {
              email
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
    expect(invitationById.body.data.workspaceInvitation).toMatchObject({
      id: invite.id,
      email: invitee.email,
      roles: ['member'],
      status: 'PENDING',
      inviter: {
        email: owner.email,
      },
    });

    const rejectedWrongEmail = await gql(
      /* GraphQL */ `
        mutation AcceptWorkspaceInvitation($invitationId: ID!) {
          acceptWorkspaceInvitation(invitationId: $invitationId) {
            invitation {
              id
            }
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

    const accepted = await gql(
      /* GraphQL */ `
        mutation AcceptWorkspaceInvitation($invitationId: ID!) {
          acceptWorkspaceInvitation(invitationId: $invitationId) {
            invitation {
              id
              status
            }
            member {
              id
              name
              email
              roles
              status
              user {
                email
              }
            }
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
    expect(accepted.body.data.acceptWorkspaceInvitation).toMatchObject({
      invitation: {
        id: invite.id,
        status: 'ACCEPTED',
      },
      member: {
        email: invitee.email,
        roles: ['member'],
        status: 'ACTIVE',
        user: {
          email: invitee.email,
        },
      },
    });
    const acceptedMemberId =
      accepted.body.data.acceptWorkspaceInvitation.member.id;

    const removed = await gql(
      /* GraphQL */ `
        mutation RemoveWorkspaceMember($id: ID!) {
          removeWorkspaceMember(id: $id) {
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
    expect(removed.body.data.removeWorkspaceMember.id).toBe(acceptedMemberId);

    const rejectedRemovedMember = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
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
    expect(rejectedRemovedMember.body.data.currentWorkspaceMember).toBeNull();
  });

  it('authenticates workspace API keys without creating a member identity', async () => {
    const owner = await createAuthenticatedUser('API Owner');
    const workspace = await createWorkspace(owner, 'Workspace API Key');
    const createdKey = await createApiKey(owner, workspace.id, {
      name: 'Runtime key',
      permissions: ['workspace:update'],
    });

    const byBearer = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentWorkspaceMember {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey },
    );

    expectNoGraphQLErrors(byBearer);
    expect(byBearer.body.data.currentWorkspace).toEqual(workspace);
    expect(byBearer.body.data.currentWorkspaceMember).toBeNull();

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
          apiKey(id: $id) {
            id
            name
            lastUsedAt
            permissions
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
    expect(touchedKey.body.data.apiKey).toMatchObject({
      id: createdKey.entity.id,
      name: 'Runtime key',
      permissions: ['workspace:update'],
    });
    expect(touchedKey.body.data.apiKey.lastUsedAt).toEqual(expect.any(String));

    const renamed = await gql(
      /* GraphQL */ `
        mutation UpdateApiKey($id: ID!, $input: UpdateApiKeyInput!) {
          updateApiKey(id: $id, input: $input) {
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
            permissions: ['workspace:update'],
          },
        },
      },
    );

    expectNoGraphQLErrors(renamed);
    expect(renamed.body.data.updateApiKey).toEqual({
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
    const createdKey = await createUserApiKey(user, {
      name: 'Personal automation',
      permissions: ['user:get', 'workspace:update', 'workspaceMember:update'],
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
          currentWorkspaceMember {
            id
          }
        }
      `,
      { bearerToken: createdKey.apiKey, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(authenticated);
    expect(authenticated.body.data.currentUser.id).toBe(user.user.id);
    expect(authenticated.body.data.currentWorkspace.id).toBe(workspace.id);
    expect(authenticated.body.data.currentWorkspaceMember.id).toEqual(
      expect.any(String),
    );

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
          userApiKeys(first: 10) {
            totalCount
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `,
      { cookies: user.cookies },
    );

    expectNoGraphQLErrors(listed);
    expect(listed.body.data.userApiKeys).toMatchObject({
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

  it('enforces workspace API-key permissions and enabled state', async () => {
    const owner = await createAuthenticatedUser('Restricted Key Owner');
    const workspace = await createWorkspace(owner, 'Restricted API Workspace');
    const restrictedKey = await createApiKey(owner, workspace.id, {
      name: 'Read workspace key',
      permissions: ['workspace:update'],
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
        mutation {
          updateWorkspace(input: { name: "Updated by API Key" }) {
            id
            name
          }
        }
      `,
      { bearerToken: restrictedKey.apiKey },
    );

    expectNoGraphQLErrors(updated);
    expect(updated.body.data.updateWorkspace).toEqual({
      id: workspace.id,
      name: 'Updated by API Key',
    });

    const denied = await gql(
      /* GraphQL */ `
        mutation {
          deleteWorkspace {
            id
          }
        }
      `,
      { bearerToken: restrictedKey.apiKey },
    );

    expectGraphQLError(denied);

    const disabled = await gql(
      /* GraphQL */ `
        mutation UpdateApiKey($id: ID!, $input: UpdateApiKeyInput!) {
          updateApiKey(id: $id, input: $input) {
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
    expect(disabled.body.data.updateApiKey.enabled).toBe(false);

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

  async function createAuthenticatedUser(
    name: string,
  ): Promise<AuthenticatedUser> {
    const email = uniqueEmail(name);
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

  async function createWorkspace(
    user: AuthenticatedUser,
    name: string,
  ): Promise<WorkspaceFixture> {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateWorkspace($input: CreateWorkspaceInput!) {
          createWorkspace(input: $input) {
            id
            name
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

    return response.body.data.createWorkspace;
  }

  async function createServiceAccount(
    user: AuthenticatedUser,
    workspaceId: string,
    name: string,
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateServiceAccount(
          $input: CreateServiceAccountWorkspaceMemberInput!
        ) {
          createServiceAccountWorkspaceMember(input: $input) {
            id
            name
            type
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: {
          input: {
            name,
          },
        },
      },
    );

    expectNoGraphQLErrors(response);

    return response.body.data.createServiceAccountWorkspaceMember as {
      id: string;
      name: string;
      type: string;
    };
  }

  async function addWorkspaceMember(
    user: AuthenticatedUser,
    workspaceId: string,
    email: string,
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation AddWorkspaceMember($input: AddWorkspaceMemberInput!) {
          addWorkspaceMember(input: $input) {
            id
            name
            email
            roles
            status
            type
            user {
              email
            }
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

    return response.body.data.addWorkspaceMember as {
      id: string;
      name: string;
      email: string | null;
      roles: string[];
      status: string;
      type: string;
      user: { email: string } | null;
    };
  }

  async function updateWorkspaceMemberRole(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
    roles: string[],
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspaceMemberRole(
          $id: ID!
          $input: UpdateWorkspaceMemberRoleInput!
        ) {
          updateWorkspaceMemberRole(id: $id, input: $input) {
            id
            roles
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
    return response.body.data.updateWorkspaceMemberRole as {
      id: string;
      roles: string[];
    };
  }

  async function setWorkspaceMemberPermissions(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
    permissions: string[],
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation SetWorkspaceMemberPermissions(
          $id: ID!
          $input: SetWorkspaceMemberPermissionsInput!
        ) {
          setWorkspaceMemberPermissions(id: $id, input: $input) {
            id
            permissions
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
    return response.body.data.setWorkspaceMemberPermissions as {
      id: string;
      permissions: string[];
    };
  }

  async function createWorkspaceInvitation(
    user: AuthenticatedUser,
    workspaceId: string,
    input: { email: string; roles: string[] },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateWorkspaceInvitation(
          $input: CreateWorkspaceInvitationInput!
        ) {
          createWorkspaceInvitation(input: $input) {
            id
            email
            expiresAt
            roles
            status
            inviter {
              email
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

    return response.body.data.createWorkspaceInvitation as {
      id: string;
      email: string;
      expiresAt: string;
      roles: string[];
      status: string;
      inviter: { email: string };
    };
  }

  async function createApiKey(
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
        mutation CreateApiKey($input: CreateApiKeyInput!) {
          createApiKey(input: $input) {
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
    expect(response.body.data.createApiKey.apiKey).toMatch(
      /^sk-[A-Za-z0-9_-]{64}$/,
    );
    expect(response.body.data.createApiKey.entity).toMatchObject({
      enabled: true,
      permissions: input.permissions ?? [],
      prefix: input.prefix ?? 'sk-',
      start: response.body.data.createApiKey.apiKey.slice(0, 8),
    });

    return response.body.data.createApiKey as {
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
        mutation CreateUserApiKey($input: CreateApiKeyInput!) {
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
      /^sk-[A-Za-z0-9_-]{64}$/,
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
    const req = request(baseUrl).post('/api/graphql').send({
      query,
      variables: options.variables,
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
