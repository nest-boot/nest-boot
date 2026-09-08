import { Migration20260902080630_Baseline } from './migrations/Migration20260902080630_Baseline.js';

describe('Migration20260902080630_Baseline', () => {
  it('bootstraps the roles required by its RLS policies', async () => {
    const migration = new Migration20260902080630_Baseline(
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
