# Example server

NestJS API used by the full-stack Nest Boot example. It demonstrates
authentication, permission checks, GraphQL connections, MikroORM,
PostgreSQL row-level security, middleware, request context, and logging.

## Run locally

Start the repository development services, create the local environment file,
and run the server:

```bash
docker compose up -d
cp examples/server/.env.example examples/server/.env
pnpm --filter @nest-boot/example-server dev
```

The API listens on `http://localhost:4000`; Better Auth is mounted at
`/api/auth` and GraphQL at `/api/graphql`.

## Verification

```bash
pnpm --filter @nest-boot/example-server build
pnpm --filter @nest-boot/example-server lint
pnpm --filter @nest-boot/example-server test
pnpm --filter @nest-boot/example-server test:e2e
```
