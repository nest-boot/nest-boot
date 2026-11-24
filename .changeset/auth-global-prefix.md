---
"@nest-boot/auth": major
---

Default authentication endpoints to the relative path `/auth` and follow the NestJS global prefix, including custom `basePath` values. With `app.setGlobalPrefix("api")`, endpoints remain at `/api/auth` without route exclusions or a duplicated prefix.

Initialize Better Auth after the application prefix is configured so HTTP handlers, session endpoints, OAuth callbacks, and authentication email links share the effective path. Both synchronous and asynchronous module registration are supported.

Applications without a global prefix must update client URLs and provider callback registrations to `/auth`, or explicitly configure `basePath: "/api/auth"`. Applications with the `api` global prefix should remove old `api/auth` exclusions and redundant `api` segments in `basePath`.

Use a public origin for `baseURL`, `AUTH_URL`, or `APP_URL`. If a URL contains a pathname, it must match the effective auth mount; conflicting paths now fail during startup. Early public service reads are reconciled with the final prefix, and root paths and trailing-slash exclusions follow the actual middleware mount.

Resolve Better Auth URL environment fallbacks, including `BETTER_AUTH_URL`, before creating the backend so inherited paths cannot bypass the effective-mount validation. Framework URL options keep precedence; matching inherited URLs are normalized and empty URL behavior is preserved.
