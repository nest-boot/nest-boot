# @nest-boot/row-level-security

## 7.2.0

### Minor Changes

- e97438a: Add `RowLevelSecurityDriver` to apply PostgreSQL row-level security at the connection execution layer, allowing lazy-loaded relations to run through fresh RLS-wrapped queries instead of entities tied to a short-lived transactional entity manager.

  Remove `setRowLevelSecurityOptions` and related runtime override hooks. RLS now applies only when the active `RequestContext` contains role or settings from `RowLevelSecurity`; ordinary MikroORM request contexts without RLS values delegate unchanged.

  Rename the request-scoped helper from `RowLevelSecurityContext` to `RowLevelSecurity`, add `RowLevelSecurityMode`, and expose `RowLevelSecurity.setMode(...)` for `AUTO`, `ENABLED`, and `DISABLED` execution modes.

  Clear previously applied transaction-local RLS state when a query runs with `RowLevelSecurityMode.DISABLED` or without an active `RequestContext` on a reused transaction, and serialize driver-managed setup plus query execution on the same transaction to avoid concurrent context interleaving.

  Remove the unsafe `RowLevelSecurityMigration.addDropPolicySql` helper; generated migrations perform grant rollback with policy diff context, while manual migrations should write explicit drop and revoke SQL.

  Add `RowLevelSecurityRole` constants for `anonymous` and `authenticated`, derive migration role creation from policy roles plus the anonymous fallback, and revoke generated grants in down migrations without dropping database roles or privileges still required by preserved policies.

### Patch Changes

- 9aa6c67: Wrap raw `using` and `withCheck` policy expressions when generating PostgreSQL policy SQL so values like `true` produce valid predicates.

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
