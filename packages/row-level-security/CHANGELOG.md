# @nest-boot/row-level-security

## 7.1.0

### Minor Changes

- 3f14d03: Add the new `@nest-boot/row-level-security` package for PostgreSQL row-level security support.

  The package includes:
  - `@Policy()` metadata for generating PostgreSQL RLS policies from entity metadata.
  - SQL helpers for bootstrapping `app.get_context(...)`, creating policy SQL, and tearing policies down safely.
  - `RowLevelSecurityContext` helpers backed by `@nest-boot/request-context`.
  - `RowLevelSecurityEntityManager`, which applies the configured database role and context values inside MikroORM transactions.
  - Migration helpers for injecting generated RLS SQL into MikroORM migrations.

  This release also adds unit coverage and a Postgres-backed integration test for context conversion, generated policy enforcement, and transaction context application.
