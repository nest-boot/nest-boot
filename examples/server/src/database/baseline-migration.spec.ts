import { readdir } from 'node:fs/promises';

import type { Migration } from '@mikro-orm/migrations';

import { Migration00000000000000_Initial } from './migrations/Migration00000000000000_Initial.js';
import { Migration20260918091003 } from './migrations/Migration20260918091003.js';

const migrations = [Migration00000000000000_Initial, Migration20260918091003];
async function sqlFor(
  MigrationClass: (typeof migrations)[number],
  direction: 'up' | 'down' = 'up',
) {
  const migration: Migration = new MigrationClass({} as never, {} as never);
  await migration[direction]();
  return migration
    .getQueries()
    .filter((query): query is string => typeof query === 'string')
    .join('\n');
}

describe('ordered auth migrations', () => {
  it('allows shared member contact emails in the generated baseline', async () => {
    expect(await sqlFor(Migration20260918091003)).not.toContain(
      'member_email_workspace_id_unique',
    );
  });
  it('keeps default privileges and generated schema in execution order', async () => {
    const files = await readdir(new URL('./migrations/', import.meta.url));
    expect(
      files.filter((file) => /^Migration.*\.ts$/.test(file)).sort(),
    ).toEqual(
      migrations.map((type) => new type({} as never, {} as never).name + '.ts'),
    );
    for (const type of migrations) {
      expect(type.name).toMatch(/^Migration\d{14}(?:_Initial)?$/);
    }
  });
  it('initializes roles without custom SQL functions before any entity tables exist', async () => {
    const sql = await sqlFor(Migration00000000000000_Initial);
    expect(sql).toContain('create role anonymous nologin noinherit;');
    expect(sql).toContain('create role authenticated nologin noinherit;');
    expect(sql).toContain('grant anonymous, authenticated to current_user;');
    expect(sql).not.toMatch(/create function|security definer/i);
    expect(sql).not.toMatch(/create table|create policy|create trigger/i);
  });
  it('installs shared extensions in a dedicated schema accessible to request roles', async () => {
    const sql = await sqlFor(Migration00000000000000_Initial);
    expect(sql).toContain('create schema if not exists extensions;');
    expect(sql).toContain(
      'create extension if not exists "uuid-ossp" with schema extensions;',
    );
    expect(sql).toContain(
      'create extension if not exists pgcrypto with schema extensions;',
    );
    expect(sql).toContain(
      'grant usage on schema extensions to anonymous, authenticated;',
    );
  });
  it('leaves entity DDL, policies and cascades entirely to the generated schema', async () => {
    expect(Migration20260918091003.name).toMatch(/^Migration\d{14}$/);
    const sql = await sqlFor(Migration20260918091003);
    expect(sql).toContain('create table "member"');
    expect(sql).toContain('create table "invitation"');
    expect(sql).toContain('member_user_id_workspace_id_unique');
    expect(sql).toContain('invitation_email_workspace_id_unique');
    expect(sql).toContain('member_all_policy');
    expect(sql).toContain('invitation_recipient_select_policy');
    expect(sql).not.toMatch(
      /create trigger|can_read_users|delete_auth_user_dependants/,
    );
    expect(sql).not.toMatch(/app\.(user|workspace)\.permissions/);
    expect(sql).not.toMatch(/deleted_at|workspace_active_|app\.operation/);
    expect(sql).toContain('create policy "workspace_delete_policy"');
    expect(sql).toContain('create table "user_api_key"');
    expect(sql).toContain('create table "workspace_api_key"');
    expect(sql).not.toContain('create table "api_key"');
    for (const column of ['user_id', 'impersonated_by_id']) {
      expect(sql).toContain(
        `foreign key ("${column}") references "user" ("id") on delete cascade`,
      );
    }
    expect(sql).toContain(
      'foreign key ("workspace_id") references "workspace" ("id") on delete cascade',
    );
    expect(sql).not.toMatch(
      /\b(grant|revoke|create function|create role|alter policy)\b/i,
    );
    expect(sql).not.toContain('workspace_member');
    expect(sql).not.toContain('workspace_invitation');
    expect(sql).not.toContain('SERVICE_ACCOUNT');
    expect(sql).not.toContain('searchable_name');
  });
  it('sets default table, function and sequence privileges before creating tables', async () => {
    const sql = await sqlFor(Migration00000000000000_Initial);
    expect(sql).toContain(
      'grant usage on schema public to anonymous, authenticated;',
    );
    expect(sql).toContain(
      'alter default privileges in schema public grant all on tables to anonymous, authenticated;',
    );
    expect(sql).toContain(
      'alter default privileges in schema public grant all on functions to anonymous, authenticated;',
    );
    expect(sql).toContain(
      'alter default privileges in schema public grant all on sequences to anonymous, authenticated;',
    );
  });
  it('leaves initialization unchanged when rolling back the generated tables', async () => {
    const sql = await sqlFor(Migration00000000000000_Initial, 'down');
    expect(sql).toBe('');
    const schemaDown = await sqlFor(Migration20260918091003, 'down');
    expect(schemaDown).toContain('drop table if exists "member"');
    expect(schemaDown).toContain('drop table if exists "invitation"');
  });
});
