import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { getAuthEntities } from '@nest-boot/auth';
import { JobEntity } from '@nest-boot/queue-api';

import { Migration00000000000000_Initial } from '../src/database/migrations/Migration00000000000000_Initial.js';
import { Migration20261024072513 } from '../src/database/migrations/Migration20261024072513.js';
import { Migration20261111023442 } from '../src/database/migrations/Migration20261111023442.js';
import { createDatabaseFixture } from './postgres.fixture.js';

const legacy = Migration20261024072513.name;
const current = Migration20261111023442.name;
const columns =
  'id::text, name, start, prefix, key, enabled, permissions, created_at, updated_at, last_used_at, expires_at';

/**
 * Creates a real PostgreSQL fixture at the published two-table API-key schema.
 * @returns Isolated database, ORM and captured legacy credential records.
 */
async function fixture() {
  const database = await createDatabaseFixture();
  const orm = await MikroORM.init({
    clientUrl: database.connectionString,
    entities: [...getAuthEntities({ workspace: { enabled: true } }), JobEntity],
    metadataProvider: TsMorphMetadataProvider,
    metadataCache: { enabled: false },
    extensions: [Migrator],
    migrations: {
      migrationsList: [
        Migration00000000000000_Initial,
        Migration20261024072513,
        Migration20261111023442,
      ],
      snapshotOnMigrate: false,
    },
  });
  await orm.migrator.up({ to: legacy });
  await database.pool.query(
    `insert into "user" (id, name, email, email_verified, roles, permissions) values (1, 'Creator', 'creator@example.test', true, '{admin}', '{}')`,
  );
  await database.pool.query(
    `insert into workspace (id, name) values (1, 'Workspace')`,
  );
  // Owner IDs deliberately collide across different entity types.
  await database.pool.query(
    `insert into member (id, name, type, user_id, workspace_id) values (1, 'Automation', 'SERVICE_ACCOUNT', null, 1)`,
  );
  await database.pool.query(
    `insert into user_api_key (id, name, start, prefix, key, enabled, permissions, user_id, created_at, updated_at, last_used_at, expires_at) values (101, 'Personal', 'user_old', 'user_', 'user-hash', true, '{user:read}', 1, '2025-01-01', '2025-02-01', '2025-03-01', '2030-01-01')`,
  );
  await database.pool.query(
    `insert into member_api_key (id, name, start, prefix, key, enabled, permissions, member_id, created_at, updated_at, last_used_at, expires_at) values (202, 'Member', 'ws_old', 'ws_', 'member-hash', false, '{workspace:read}', 1, '2025-04-01', '2025-05-01', null, null)`,
  );
  const readLegacy = async () => ({
    user: (
      await database.pool.query(
        `select ${columns}, user_id::text from user_api_key order by id`,
      )
    ).rows,
    member: (
      await database.pool.query(
        `select ${columns}, member_id::text from member_api_key order by id`,
      )
    ).rows,
  });
  const original = await readLegacy();
  return {
    ...database,
    orm,
    readLegacy,
    original,
    async close() {
      await orm.close();
      await database.close();
    },
  };
}

it('preserves every credential field and owner through upgrade and rollback, including generated-ID sequences', async () => {
  const db = await fixture();
  try {
    expect(await db.orm.migrator.up()).toHaveLength(1);
    const user = (
      await db.pool.query(
        `select ${columns}, owner_id::text as user_id from api_key where owner_type = 'user'`,
      )
    ).rows;
    const member = (
      await db.pool.query(
        `select ${columns}, owner_id::text as member_id from api_key where owner_type = 'member'`,
      )
    ).rows;
    expect({ user, member }).toEqual(db.original);
    expect(
      (await db.pool.query(`select nextval('api_key_id_seq')::text as next`))
        .rows,
    ).toEqual([{ next: '203' }]);
    expect(await db.orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
    await db.orm.migrator.down({ to: legacy });
    expect(await db.readLegacy()).toEqual(db.original);
    expect(
      (
        await db.pool.query(
          `select nextval('user_api_key_id_seq')::text as next`,
        )
      ).rows,
    ).toEqual([{ next: '102' }]);
    expect(
      (
        await db.pool.query(
          `select nextval('member_api_key_id_seq')::text as next`,
        )
      ).rows,
    ).toEqual([{ next: '203' }]);
    expect(await db.orm.migrator.up()).toHaveLength(1);
    expect(await db.orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  } finally {
    await db.close();
  }
});

it.each(['id', 'key'])(
  'aborts atomically when legacy %s values collide instead of remapping or activating ambiguous credentials',
  async (field) => {
    const db = await fixture();
    try {
      await db.pool.query(
        `update member_api_key set ${field} = (select ${field} from user_api_key limit 1)`,
      );
      const before = await db.readLegacy();
      await expect(db.orm.migrator.up()).rejects.toThrow(
        field === 'id' ? /IDs conflict/ : /hashes conflict/,
      );
      expect(await db.readLegacy()).toEqual(before);
      expect(
        (await db.pool.query(`select to_regclass('api_key') as api_key`)).rows,
      ).toEqual([{ api_key: null }]);
      expect(await db.orm.migrator.getExecuted()).toHaveLength(2);
    } finally {
      await db.close();
    }
  },
);

it('refuses to roll back system identities into a schema that cannot represent them', async () => {
  const db = await fixture();
  try {
    await db.orm.migrator.up();
    await db.pool.query(
      `insert into system_account (id, name) values (500, 'Integration')`,
    );
    await db.pool.query(
      `insert into api_key (id, name, key, owner_type, owner_id) values (501, 'Integration', 'system-hash', 'system_account', 500)`,
    );
    await expect(db.orm.migrator.down({ to: legacy })).rejects.toThrow(
      /Delete system accounts/,
    );
    expect(
      (await db.pool.query(`select id::text from api_key where id = 501`)).rows,
    ).toEqual([{ id: '501' }]);
    expect((await db.orm.migrator.getExecuted()).at(-1)?.name).toBe(current);
    await db.pool.query('delete from system_account where id = 500');
    expect(
      (await db.pool.query('select id from api_key where id = 501')).rows,
    ).toEqual([]);
    await db.orm.migrator.down({ to: legacy });
    expect(await db.readLegacy()).toEqual(db.original);
  } finally {
    await db.close();
  }
});

it.each(['insert-first', 'delete-first'])(
  'serializes polymorphic owner insertion with concurrent deletion (%s)',
  async (order) => {
    const db = await fixture();
    try {
      await db.orm.migrator.up();
      await db.pool.query(
        `insert into system_account (id, name) values (500, 'Concurrent owner')`,
      );
      const first = await db.pool.connect();
      const second = await db.pool.connect();
      try {
        await first.query('begin');
        await second.query('begin');
        const insert = `insert into api_key (id, name, key, owner_type, owner_id) values (501, 'Concurrent key', 'concurrent-hash', 'system_account', 500)`;
        if (order === 'insert-first') {
          await first.query(insert);
          const deleted = second.query(
            'delete from system_account where id = 500',
          );
          await first.query('commit');
          await deleted;
          await second.query('commit');
        } else {
          await first.query('delete from system_account where id = 500');
          const inserted = second.query(insert);
          const assertion =
            expect(inserted).rejects.toThrow(/owner does not exist/);
          await first.query('commit');
          await assertion;
          await second.query('rollback');
        }
        expect(
          (await db.pool.query('select id from api_key where id = 501')).rows,
        ).toEqual([]);
      } finally {
        await first.query('rollback');
        await second.query('rollback');
        first.release();
        second.release();
      }
    } finally {
      await db.close();
    }
  },
);

it('keeps same-ID member and system owners independent when deleting a user also clears creator audit references', async () => {
  const db = await fixture();
  try {
    await db.orm.migrator.up();
    await db.pool.query(
      `insert into system_account (id, name, created_by_id) values (1, 'Independent', 1)`,
    );
    await db.pool.query(
      `insert into api_key (id, name, key, owner_type, owner_id, created_by_id) values (303, 'User', 'new-user-hash', 'user', 1, 1), (404, 'Member', 'new-member-hash', 'member', 1, 1), (505, 'System', 'new-system-hash', 'system_account', 1, 1)`,
    );
    await db.pool.query('delete from "user" where id = 1');
    expect(
      (
        await db.pool.query(
          'select owner_type, owner_id::text, created_by_id from api_key order by id',
        )
      ).rows,
    ).toEqual([
      { owner_type: 'member', owner_id: '1', created_by_id: null },
      { owner_type: 'member', owner_id: '1', created_by_id: null },
      { owner_type: 'system_account', owner_id: '1', created_by_id: null },
    ]);
    expect(
      (
        await db.pool.query(
          'select created_by_id from system_account where id = 1',
        )
      ).rows,
    ).toEqual([{ created_by_id: null }]);
    await db.pool.query('delete from workspace where id = 1');
    expect(
      (await db.pool.query('select owner_type from api_key')).rows,
    ).toEqual([{ owner_type: 'system_account' }]);
  } finally {
    await db.close();
  }
});
