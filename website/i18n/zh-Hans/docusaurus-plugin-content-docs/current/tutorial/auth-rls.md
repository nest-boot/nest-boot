---
sidebar_position: 2
---

# 行级安全 (Auth RLS)

`@nest-boot/auth-rls` 模块为使用 MikroORM 的 PostgreSQL 数据库提供了行级安全 (RLS) 支持，并与 `@nest-boot/auth` 集成。

## 安装

```bash
npm install @nest-boot/auth-rls
# or
pnpm add @nest-boot/auth-rls
```

## 配置

在你的应用程序模块中注册 `AuthRlsModule`。它应该在 `AuthModule` 之后导入。

```typescript
import { Module } from "@nestjs/common";
import { AuthRlsModule } from "@nest-boot/auth-rls";

@Module({
  imports: [
    AuthRlsModule.forRoot({
      // 可选：自定义上下文
      context: async (ctx) => {
        // ...
        return ctx;
      },
    }),
  ],
})
export class AppModule {}
```

## 使用

该模块会根据经过认证的用户自动为当前事务设置 PostgreSQL 角色和配置变量。

- 如果用户已认证，它将设置 `ROLE` 为 `authenticated`，并在数据库会话中设置 `auth.user_id`、`auth.user_name` 和 `auth.user_email`。
- 如果没有用户认证，它将设置 `ROLE` 为 `anonymous`。

这允许你在 PostgreSQL 数据库中定义依赖于这些设置的行级安全策略。

### 策略示例

```sql
CREATE POLICY "Users can only update their own profile" ON public.user
  FOR UPDATE
  USING (id = current_setting('auth.user_id')::uuid);
```
