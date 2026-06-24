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
  name: 'AllInOneE2eDbProbe',
  tableName: 'all_in_one_e2e_db_probe',
  properties: {
    id: {
      type: 'number',
      primary: true,
    },
  },
});

const adminDatabaseUrl =
  process.env.SERVER_E2E_DATABASE_URL ??
  'postgresql://postgres:secret@localhost:5432/postgres';
const databaseName = `all_in_one_e2e_${process.pid}_${Date.now()}`;
const databaseUrl = databaseUrlFor(databaseName);
const execFileAsync = promisify(execFile);
const graphqlRequireShim = `${process.cwd()}/scripts/nestjs-graphql-require-shim.mjs`;
const envKeys = [
  'NODE_ENV',
  'DB_URL',
  'DATABASE_URL',
  'APP_URL',
  'AUTH_URL',
  'APP_SECRET',
  'AUTH_SECRET',
  'AUTH_OIDC_ID',
  'AUTH_OIDC_SECRET',
  'AUTH_OIDC_DISCOVERY_URL',
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
    serverProcess = spawn(
      process.execPath,
      ['--trace-uncaught', '--import', graphqlRequireShim, 'dist/main.js'],
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
    expect(collectSetCookies(registered).length).toBeGreaterThan(0);

    const rejectedLogin = await signInWithEmail({
      email,
      password: 'wrong-password',
    });

    expect(rejectedLogin.status).toBe(401);

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
            role
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
      role: 'OWNER',
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
            role
          }
        }
      `,
      {
        cookies: [...alice.cookies, `workspace_id=${aliceWorkspace.id}`],
      },
    );

    expectNoGraphQLErrors(fromCookie);
    expect(fromCookie.body.data.currentWorkspace).toEqual(aliceWorkspace);
    expect(fromCookie.body.data.currentWorkspaceMember.role).toBe('OWNER');

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

    await updateWorkspaceMember(owner, workspace.id, member.id, {
      role: 'ADMIN',
    });

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

    const currentMember = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
            id
            role
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
      role: 'MEMBER',
      status: 'ACTIVE',
      type: 'USER',
      user: {
        email: memberUser.email,
      },
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

    const invite = await createWorkspaceInvite(owner, workspace.id, {
      email: invitee.email,
      role: 'MEMBER',
    });

    const inviteByToken = await gql(
      /* GraphQL */ `
        query WorkspaceMemberByToken($token: String!) {
          workspaceMemberByToken(token: $token) {
            id
            email
            role
            status
            invitedBy {
              email
            }
          }
        }
      `,
      {
        cookies: invitee.cookies,
        variables: {
          token: invite.inviteToken,
        },
      },
    );

    expectNoGraphQLErrors(inviteByToken);
    expect(inviteByToken.body.data.workspaceMemberByToken).toMatchObject({
      id: invite.id,
      email: invitee.email,
      role: 'MEMBER',
      status: 'INVITING',
      invitedBy: {
        email: owner.email,
      },
    });

    const rejectedWrongEmail = await gql(
      /* GraphQL */ `
        mutation AcceptWorkspaceInvite(
          $token: String!
          $input: AcceptWorkspaceInviteInput
        ) {
          acceptWorkspaceInvite(token: $token, input: $input) {
            workspaceId
          }
        }
      `,
      {
        cookies: wrongInvitee.cookies,
        variables: {
          token: invite.inviteToken,
          input: {
            name: 'Wrong Invitee',
          },
        },
      },
    );

    expectGraphQLError(rejectedWrongEmail);

    const accepted = await gql(
      /* GraphQL */ `
        mutation AcceptWorkspaceInvite(
          $token: String!
          $input: AcceptWorkspaceInviteInput
        ) {
          acceptWorkspaceInvite(token: $token, input: $input) {
            workspaceId
            workspaceMember {
              id
              name
              email
              role
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
          token: invite.inviteToken,
          input: {
            name: 'Accepted Invitee',
          },
        },
      },
    );

    expectNoGraphQLErrors(accepted);
    expect(accepted.body.data.acceptWorkspaceInvite).toMatchObject({
      workspaceId: workspace.id,
      workspaceMember: {
        id: invite.id,
        name: 'Accepted Invitee',
        email: invitee.email,
        role: 'MEMBER',
        status: 'ACTIVE',
        user: {
          email: invitee.email,
        },
      },
    });

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
          id: invite.id,
        },
      },
    );

    expectNoGraphQLErrors(removed);
    expect(removed.body.data.removeWorkspaceMember.id).toBe(invite.id);

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

  it('manages workspace member groups and merges group permissions', async () => {
    const owner = await createAuthenticatedUser('Group Owner');
    const memberUser = await createAuthenticatedUser('Group Member');
    const workspace = await createWorkspace(owner, 'Group Workspace');
    const member = await addWorkspaceMember(
      owner,
      workspace.id,
      memberUser.email,
    );

    const group = await createWorkspaceMemberGroup(owner, workspace.id, {
      name: 'Operators',
      description: 'Operational access',
      permissions: ['MANAGE_MEMBERS'],
      memberIds: [member.id],
    });

    expect(group).toMatchObject({
      name: 'Operators',
      description: 'Operational access',
      permissions: ['MANAGE_MEMBERS'],
      members: {
        totalCount: 1,
      },
    });

    const memberPermissions = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
            id
            effectivePermissions
            groups(first: 10) {
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
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(memberPermissions);
    expect(
      memberPermissions.body.data.currentWorkspaceMember.effectivePermissions,
    ).toEqual(expect.arrayContaining(['MANAGE_MEMBERS']));
    expect(
      memberPermissions.body.data.currentWorkspaceMember.groups,
    ).toMatchObject({
      totalCount: 1,
      edges: [
        {
          node: {
            id: group.id,
            name: 'Operators',
          },
        },
      ],
    });

    const updatedGroup = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspaceMemberGroup(
          $id: ID!
          $input: UpdateWorkspaceMemberGroupInput!
        ) {
          updateWorkspaceMemberGroup(id: $id, input: $input) {
            id
            name
            description
            permissions
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: group.id,
          input: {
            name: 'Workspace Managers',
            description: 'Workspace administration',
            permissions: ['MANAGE_WORKSPACE'],
          },
        },
      },
    );

    expectNoGraphQLErrors(updatedGroup);
    expect(updatedGroup.body.data.updateWorkspaceMemberGroup).toEqual({
      id: group.id,
      name: 'Workspace Managers',
      description: 'Workspace administration',
      permissions: ['MANAGE_WORKSPACE'],
    });

    const removedFromGroup = await gql(
      /* GraphQL */ `
        mutation RemoveMembersFromWorkspaceMemberGroup(
          $id: ID!
          $memberIds: [ID!]!
        ) {
          removeMembersFromWorkspaceMemberGroup(
            id: $id
            memberIds: $memberIds
          ) {
            id
            members(first: 10) {
              totalCount
            }
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: group.id,
          memberIds: [member.id],
        },
      },
    );

    expectNoGraphQLErrors(removedFromGroup);
    expect(
      removedFromGroup.body.data.removeMembersFromWorkspaceMemberGroup.members
        .totalCount,
    ).toBe(0);

    const addedBackToGroup = await gql(
      /* GraphQL */ `
        mutation AddMembersToWorkspaceMemberGroup(
          $id: ID!
          $memberIds: [ID!]!
        ) {
          addMembersToWorkspaceMemberGroup(id: $id, memberIds: $memberIds) {
            id
            members(first: 10) {
              totalCount
            }
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: group.id,
          memberIds: [member.id],
        },
      },
    );

    expectNoGraphQLErrors(addedBackToGroup);
    expect(
      addedBackToGroup.body.data.addMembersToWorkspaceMemberGroup.members
        .totalCount,
    ).toBe(1);

    const deletedGroup = await gql(
      /* GraphQL */ `
        mutation DeleteWorkspaceMemberGroup($id: ID!) {
          deleteWorkspaceMemberGroup(id: $id) {
            id
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: group.id,
        },
      },
    );

    expectNoGraphQLErrors(deletedGroup);
    expect(deletedGroup.body.data.deleteWorkspaceMemberGroup.id).toBe(group.id);

    const groups = await gql(
      /* GraphQL */ `
        query {
          workspaceMemberGroups(first: 10) {
            totalCount
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(groups);
    expect(groups.body.data.workspaceMemberGroups.totalCount).toBe(0);
  });

  it('authenticates user-owned API keys as the owning workspace member', async () => {
    const owner = await createAuthenticatedUser('API Owner');
    const memberUser = await createAuthenticatedUser('API Member');
    const workspace = await createWorkspace(owner, 'User API Workspace');
    const createdKey = await createApiKey(owner, workspace.id, {
      name: 'Owner runtime key',
    });
    await addWorkspaceMember(owner, workspace.id, memberUser.email);

    const byBearer = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
            id
            type
          }
        }
      `,
      { bearerToken: createdKey.apiKey },
    );

    expectNoGraphQLErrors(byBearer);
    expect(byBearer.body.data.currentWorkspaceMember).toMatchObject({
      type: 'USER',
    });

    const apiKeyWithWorkspaceHeader = await gql(
      /* GraphQL */ `
        query {
          currentWorkspaceMember {
            id
            type
          }
        }
      `,
      { bearerToken: createdKey.apiKey, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(apiKeyWithWorkspaceHeader);
    expect(
      apiKeyWithWorkspaceHeader.body.data.currentWorkspaceMember,
    ).toMatchObject({
      type: 'USER',
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

    const touchedKey = await gql(
      /* GraphQL */ `
        query ApiKey($id: ID!) {
          apiKey(id: $id) {
            id
            name
            lastUsedAt
            member {
              user {
                email
              }
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
    expect(touchedKey.body.data.apiKey).toMatchObject({
      id: createdKey.entity.id,
      name: 'Owner runtime key',
      member: {
        user: {
          email: owner.email,
        },
      },
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
            name: 'Renamed owner runtime key',
          },
        },
      },
    );

    expectNoGraphQLErrors(renamed);
    expect(renamed.body.data.updateApiKey).toEqual({
      id: createdKey.entity.id,
      name: 'Renamed owner runtime key',
    });

    const rejectedMemberRead = await gql(
      /* GraphQL */ `
        query ApiKey($id: ID!) {
          apiKey(id: $id) {
            id
          }
        }
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
        variables: {
          id: createdKey.entity.id,
        },
      },
    );

    expectGraphQLError(rejectedMemberRead);

    const memberKey = await createApiKey(memberUser, workspace.id, {
      name: 'Member runtime key',
    });

    const memberVisibleKeys = await gql(
      /* GraphQL */ `
        query {
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
      `,
      {
        cookies: memberUser.cookies,
        workspaceId: workspace.id,
      },
    );

    expectNoGraphQLErrors(memberVisibleKeys);
    expect(memberVisibleKeys.body.data.apiKeys).toMatchObject({
      totalCount: 1,
      edges: [
        {
          node: {
            id: memberKey.entity.id,
            name: 'Member runtime key',
          },
        },
      ],
    });
  });

  it('authenticates service account API keys without a user and scopes API key access by member', async () => {
    const owner = await createAuthenticatedUser('Service Owner');
    const workspace = await createWorkspace(owner, 'Service API Workspace');
    const ownerKey = await createApiKey(owner, workspace.id, {
      name: 'Owner key',
    });
    const serviceAccount = await createServiceAccount(
      owner,
      workspace.id,
      'Deploy Bot',
    );
    const serviceKey = await createApiKey(owner, workspace.id, {
      name: 'Deploy key',
      workspaceMemberId: serviceAccount.id,
    });

    const byHeader = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
            name
          }
          currentWorkspaceMember {
            id
            name
            type
            user {
              id
            }
          }
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
      `,
      { apiKey: serviceKey.apiKey, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(byHeader);
    expect(byHeader.body.data.currentWorkspace).toEqual(workspace);
    expect(byHeader.body.data.currentWorkspaceMember).toEqual({
      id: serviceAccount.id,
      name: 'Deploy Bot',
      type: 'SERVICE_ACCOUNT',
      user: null,
    });
    expect(byHeader.body.data.apiKeys).toMatchObject({
      totalCount: 1,
      edges: [
        {
          node: {
            id: serviceKey.entity.id,
            name: 'Deploy key',
          },
        },
      ],
    });

    const serviceAccountUser = await gql(
      /* GraphQL */ `
        query {
          currentUser {
            id
          }
        }
      `,
      { apiKey: serviceKey.apiKey, workspaceId: workspace.id },
    );

    expectGraphQLError(serviceAccountUser);

    const ownerVisibleKeys = await gql(
      /* GraphQL */ `
        query {
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
      `,
      { cookies: owner.cookies, workspaceId: workspace.id },
    );

    expectNoGraphQLErrors(ownerVisibleKeys);
    expect(ownerVisibleKeys.body.data.apiKeys.totalCount).toBe(2);
    expect(
      ownerVisibleKeys.body.data.apiKeys.edges.map(
        (edge: { node: { id: string } }) => edge.node.id,
      ),
    ).toEqual(
      expect.arrayContaining([ownerKey.entity.id, serviceKey.entity.id]),
    );

    const deleted = await gql(
      /* GraphQL */ `
        mutation DeleteApiKey($id: ID!) {
          deleteApiKey(id: $id) {
            id
          }
        }
      `,
      {
        cookies: owner.cookies,
        workspaceId: workspace.id,
        variables: {
          id: serviceKey.entity.id,
        },
      },
    );

    expectNoGraphQLErrors(deleted);
    expect(deleted.body.data.deleteApiKey.id).toBe(serviceKey.entity.id);

    const rejectedDeletedKey = await gql(
      /* GraphQL */ `
        query {
          currentWorkspace {
            id
          }
        }
      `,
      { apiKey: serviceKey.apiKey, workspaceId: workspace.id },
    );

    expect(rejectedDeletedKey.status).toBe(401);
    expect(rejectedDeletedKey.body).toMatchObject({
      message: 'Invalid API key',
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
            role
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
      role: string;
      status: string;
      type: string;
      user: { email: string } | null;
    };
  }

  async function updateWorkspaceMember(
    user: AuthenticatedUser,
    workspaceId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation UpdateWorkspaceMember(
          $id: ID!
          $input: UpdateWorkspaceMemberInput!
        ) {
          updateWorkspaceMember(id: $id, input: $input) {
            id
            name
            email
            role
            status
            permissions
          }
        }
      `,
      {
        cookies: user.cookies,
        workspaceId,
        variables: {
          id,
          input,
        },
      },
    );

    expectNoGraphQLErrors(response);

    return response.body.data.updateWorkspaceMember as {
      id: string;
      name: string;
      email: string | null;
      role: string;
      status: string;
      permissions: string[];
    };
  }

  async function createWorkspaceInvite(
    user: AuthenticatedUser,
    workspaceId: string,
    input: { email?: string; role: string },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateWorkspaceInvite($input: CreateWorkspaceInviteInput!) {
          createWorkspaceInvite(input: $input) {
            id
            email
            inviteToken
            role
            status
            invitedBy {
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

    return response.body.data.createWorkspaceInvite as {
      id: string;
      email: string | null;
      inviteToken: string;
      role: string;
      status: string;
      invitedBy: { email: string } | null;
    };
  }

  async function createWorkspaceMemberGroup(
    user: AuthenticatedUser,
    workspaceId: string,
    input: {
      description?: string;
      memberIds?: string[];
      name: string;
      permissions?: string[];
    },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateWorkspaceMemberGroup(
          $input: CreateWorkspaceMemberGroupInput!
        ) {
          createWorkspaceMemberGroup(input: $input) {
            id
            name
            description
            permissions
            members(first: 10) {
              totalCount
              edges {
                node {
                  id
                }
              }
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

    return response.body.data.createWorkspaceMemberGroup as {
      id: string;
      name: string;
      description: string | null;
      permissions: string[];
      members: {
        totalCount: number;
        edges: { node: { id: string } }[];
      };
    };
  }

  async function createApiKey(
    user: AuthenticatedUser,
    workspaceId: string,
    input: { expiresAt?: string; name: string; workspaceMemberId?: string },
  ) {
    const response = await gql(
      /* GraphQL */ `
        mutation CreateApiKey($input: CreateApiKeyInput!) {
          createApiKey(input: $input) {
            apiKey
            entity {
              id
              name
              keyPrefix
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
    expect(response.body.data.createApiKey.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
    expect(response.body.data.createApiKey.entity.keyPrefix).toBe('sk-');

    return response.body.data.createApiKey as {
      apiKey: string;
      entity: {
        id: string;
        name: string;
        keyPrefix: string;
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

    if (options.apiKey) {
      req.set('x-api-key', options.apiKey);
    }

    return req;
  }

  function signUpWithEmail(input: EmailSignUpInput) {
    return request(baseUrl).post('/api/auth/sign-up/email').send(input);
  }

  function signInWithEmail(input: EmailSignInInput) {
    return request(baseUrl).post('/api/auth/sign-in/email').send(input);
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
  apiKey?: string;
  bearerToken?: string;
  cookies?: string[];
  workspaceId?: string;
  variables?: Record<string, unknown>;
}

function uniqueEmail(seed: string) {
  const normalizedSeed = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  uniqueCounter += 1;

  return `${normalizedSeed}-${process.pid}-${Date.now()}-${uniqueCounter}@example.com`;
}

function collectSetCookies(response: request.Response) {
  const header = response.headers['set-cookie'];

  if (!header) {
    return [];
  }

  return (Array.isArray(header) ? header : [header]).map(
    (cookie) => cookie.split(';')[0],
  );
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
  process.env.AUTH_OIDC_ID = 'all-in-one-e2e';
  process.env.AUTH_OIDC_SECRET = 'all-in-one-e2e-secret';
  process.env.AUTH_OIDC_DISCOVERY_URL =
    'https://auth.example.test/.well-known/openid-configuration';
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
