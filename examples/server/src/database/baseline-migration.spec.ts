import { Migration20260910000000_Baseline } from './migrations/Migration20260910000000_Baseline.js';

describe('Migration20260910000000_Baseline', () => {
  it('bootstraps the roles required by its RLS policies', async () => {
    const migration = new Migration20260910000000_Baseline(
      {} as never,
      {} as never,
    );

    await migration.up();

    expect(migration.getQueries()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('create role anonymous nologin'),
        expect.stringContaining('create role authenticated nologin'),
        'grant anonymous, authenticated to current_user;',
      ]),
    );
  });
});
