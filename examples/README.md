# Examples

The example is split into two independently runnable applications:

- `client`: TanStack Start, Apollo Client, Better Auth, and shadcn UI.
- `server`: NestJS, GraphQL, Better Auth, MikroORM, and PostgreSQL.

From the repository root:

```bash
docker compose up -d
cp examples/server/.env.example examples/server/.env
pnpm --filter @nest-boot/example-server dev
pnpm --filter @nest-boot/example-client dev
```

Open `http://localhost:3000`. Requests under `/api` are proxied to the server
at `http://localhost:4000`.
