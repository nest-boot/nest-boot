---
"@nest-boot/row-level-security": minor
---

Add `RowLevelSecurityDriver` to apply PostgreSQL row-level security at the connection execution layer, allowing lazy-loaded relations to run through fresh RLS-wrapped queries instead of entities tied to a short-lived transactional entity manager.

Remove `setRowLevelSecurityOptions` and related runtime override hooks. RLS now applies only when the active `RequestContext` contains role or settings from `RowLevelSecurity`; ordinary MikroORM request contexts without RLS values delegate unchanged.

Rename the request-scoped helper from `RowLevelSecurityContext` to `RowLevelSecurity`, add `RowLevelSecurityMode`, and expose `RowLevelSecurity.setMode(...)` for `AUTO`, `ENABLED`, and `DISABLED` execution modes.

Clear previously applied transaction-local RLS state when a query runs with `RowLevelSecurityMode.DISABLED`, and serialize driver-managed setup plus query execution on the same transaction to avoid concurrent context interleaving.

Add `RowLevelSecurityRole` constants for `anonymous` and `authenticated`, derive migration role creation from policy roles plus the anonymous fallback, and revoke generated grants in down migrations without dropping database roles or privileges still required by preserved policies.
