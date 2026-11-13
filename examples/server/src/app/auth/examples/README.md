# Business authorization recipe

This optional, tested recipe is not registered by the running example application.
It does not add an auth entity, database table, GraphQL resolver, or route.

1. `report-auth.options.ts` declares the permission catalog, additive roles, and
   permission-bound object rules. Merge these options with your existing
   `AuthModule.forRoot()` configuration when adopting the recipe. Merge nested
   options deliberately; do not overwrite unrelated callbacks or role grants.
2. `report.ts` is a minimal business resource, separate from auth entities.
3. Implement `ReportRepository` using your persistence layer and register it with
   `ReportService` in your business module. Keep the global `AuthGuard` enabled.
4. Pass only the operation target's ID from a resolver/controller. `ReportService`
   loads trusted ownership/state before checking the unified request ability.
5. Query `currentAbilityRules` and hydrate them with the client example's
   `createAbility()`. Include `workspaceId` and `archived` in report selections and
   check `createAbilitySubject('Report', report)` to preserve object conditions.
6. Build key editors from `workspaceApiKeyPermissions`, preselecting only entries
   with `default && grantable`. This does not authorize archiving a specific report.

`permissions` declares vocabulary; it grants nothing on its own. `roles` assigns
permissions, and same-name roles extend the built-ins. Entity role/permission
setters replace stored assignments. The `can({ workspace: permission }, action, subject, conditions)`
callback automatically checks effective permissions, including credential ceilings;
do not duplicate that check in the callback. Action names and subject classes remain
case-sensitive, while GraphQL permission inputs use generated enum names.

The example deliberately uses operation/object authorization, not field-level
restrictions. Built-in auth Service methods do not automatically enforce CASL field
rules; application-specific field rules require corresponding Service checks.
Frontend decisions control presentation only, never replace Service authorization.
Do not mutate module options at runtime; update assignments through auth Services.

Run the recipe's cross-layer tests:

```bash
pnpm --filter @nest-boot/auth build
pnpm --filter @nest-boot/example-server exec vitest run src/app/auth/examples/report-authorization.spec.ts
```

The tests cover roles, direct grants, object conditions, empty/restricted API keys,
missing reports, default/grantable metadata, and server-rule serialization consumed
by the real client helper. Persistence is mocked; this is not a database or browser test.
