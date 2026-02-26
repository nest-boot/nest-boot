---
sidebar_position: 2
---

# Auth RLS

The `@nest-boot/auth-rls` module provides Row Level Security (RLS) support for PostgreSQL using MikroORM, integrated with `@nest-boot/auth`.

## Installation

```bash
npm install @nest-boot/auth-rls
# or
pnpm add @nest-boot/auth-rls
```

## Setup

Register the `AuthRlsModule` in your application module. It should be imported after `AuthModule`.

```typescript
import { Module } from "@nestjs/common";
import { AuthRlsModule } from "@nest-boot/auth-rls";

@Module({
  imports: [
    AuthRlsModule.forRoot({
      // Optional: customize context
      context: async (ctx) => {
        // ...
        return ctx;
      },
    }),
  ],
})
export class AppModule {}
```

## Usage

The module automatically sets the PostgreSQL role and configuration variables for the current transaction based on the authenticated user.

- If a user is authenticated, it sets `ROLE` to `authenticated` and `auth.user_id`, `auth.user_name`, `auth.user_email` in the database session.
- If no user is authenticated, it sets `ROLE` to `anonymous`.

This allows you to define Row Level Security policies in your PostgreSQL database that rely on these settings.

### Example Policy

```sql
CREATE POLICY "Users can only update their own profile" ON public.user
  FOR UPDATE
  USING (id = current_setting('auth.user_id')::uuid);
```
