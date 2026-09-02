# Example client

TanStack Start client for the Nest Boot full-stack example. It uses Apollo
Client for GraphQL, Better Auth for browser authentication, shadcn-based UI
components, internationalization, and Playwright end-to-end tests.

## Run locally

Start the example server first, then run the client:

```bash
cp examples/server/.env.example examples/server/.env
pnpm --filter @nest-boot/example-server dev
pnpm --filter @nest-boot/example-client dev
```

The client listens on `http://localhost:3000` and proxies `/api` requests to
`http://localhost:4000`.

## Generated GraphQL types

The checked-in GraphQL client types are generated from
`examples/server/schema.gql`:

```bash
pnpm --filter @nest-boot/example-client codegen
```

## Verification

```bash
pnpm --filter @nest-boot/example-client build
pnpm --filter @nest-boot/example-client lint
pnpm --filter @nest-boot/example-client test
pnpm --filter @nest-boot/example-client test:e2e
```
