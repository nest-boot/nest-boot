# @nest-boot/jwt

Registers a database-backed JWT signer and a public JWKS controller. Both direct
`JwtModule` imports and `JwtModule.forRoot` / `JwtModule.forRootAsync` require
`DatabaseModule`, `CryptModule`, and a migration for the `jwk` table:

```ts
import { CryptModule } from "@nest-boot/crypt";
import { DatabaseModule } from "@nest-boot/database";
import { JwtModule } from "@nest-boot/jwt";
import { Module } from "@nestjs/common";

@Module({
  imports: [DatabaseModule.forRoot({ entities: [] }), CryptModule, JwtModule],
})
export class AppModule {}
```

Use `JwtModule.forRoot` or `JwtModule.forRootAsync` to customize the issuer or
JWKS endpoint:

```ts
JwtModule.forRoot({
  jwks: { path: "/.well-known/jwks.json" },
});
```

The issuer defaults to `AUTH_URL`, then `APP_URL`. Set `issuer` to override this
value. Signing private keys are encrypted at rest via `CryptService` using the
`"jwt"` HKDF context. Every application instance must share the same issuer and
`CryptModule` secret.

Inject `JwtService` to sign and verify tokens. A signing request creates a key
when no active key exists. JWKS reads publish public keys within their signing
or grace period. An empty key table returns an empty key set. Signing defaults
to Ed25519, with 30 days each for the rotation interval and the grace period.

Keep the JWKS route outside the global prefix when using the default well-known
path. Use `app.get(JwtService).jwksPath` in the host application's prefix exclusions.
`jwks.decorators` defaults to `[Public()]` from `@nest-boot/common` so global
authentication guards allow access automatically; pass additional class decorators
(for example `[Public(), SkipThrottle()]` or `UseGuards(...)` / `UseInterceptors(...)`)
when needed.

The `jwk` table inherits the application's default database table privileges.
