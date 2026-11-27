# @nest-boot/jwt

Registers a database-backed JWT signer and a public JWKS controller. Import
`JwtModule` alongside the application's `DatabaseModule` and generate a migration
for the `jwk` table.

```ts
JwtModule.forRoot({
  jwks: { path: "/.well-known/jwks.json" },
});
```

The issuer defaults to `AUTH_URL`, then `APP_URL`. The encryption secret defaults
to `JWT_SECRET`, then `AUTH_SECRET`, then `APP_SECRET`. Set `issuer` or `secret`
to override these values. Every application instance must use the same issuer
and strong encryption secret.

Inject `JwtService` to sign and verify tokens. A signing request creates a key
when no active key exists. JWKS reads publish public keys within their signing
or grace period. An empty key table returns an empty key set. Signing defaults
to Ed25519, with 30 days each for the rotation interval and the grace period.

Keep the JWKS route outside the global prefix when using the default well-known
path. Use `app.get(JwtService).jwksPath` in the host application's prefix exclusions.
`jwks.decorators` defaults to `[Public()]` from `@nest-boot/common` so global
authentication guards allow access automatically; pass additional request-time
metadata decorators (for example `[Public(), SkipThrottle()]`) when needed.

The `jwk` table inherits the application's default database table privileges.
