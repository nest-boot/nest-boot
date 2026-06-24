# Nest Boot All In One

End-to-end example server for the `@nest-boot/*` workspace packages.

This app is copied from the server project template and adapted for this
monorepo:

- ES modules with NodeNext TypeScript resolution.
- `@nest-boot/*` packages resolved from the local pnpm workspace.
- NestJS 12 next dependencies.
- MikroORM v7 with PostgreSQL and row-level security migrations.
- Vitest unit and e2e tests.
- ESLint flat config through `@nest-boot/eslint-config`.

## Setup

```bash
pnpm install
cp examples/all-in-one/.env.example examples/all-in-one/.env
```

Update `DATABASE_URL` in `.env` before running the app or migrations.

## Scripts

```bash
pnpm --filter @nest-boot/example-all-in-one build
pnpm --filter @nest-boot/example-all-in-one dev
pnpm --filter @nest-boot/example-all-in-one lint
pnpm --filter @nest-boot/example-all-in-one test
pnpm --filter @nest-boot/example-all-in-one test:e2e
```
