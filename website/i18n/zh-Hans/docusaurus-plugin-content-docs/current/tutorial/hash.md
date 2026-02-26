---
sidebar_position: 2
---

# Hash

`@nest-boot/hash` 模块通过 `@node-rs/argon2` 提供基于 Argon2 算法的密码哈希工具。

## 安装

```bash
npm install @nest-boot/hash @node-rs/argon2
# or
pnpm add @nest-boot/hash @node-rs/argon2
```

## 配置

在你的应用程序模块中注册 `HashModule`。

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    HashModule.register({
      // secret: process.env.HASH_SECRET, // 如果设置了 HASH_SECRET 或 APP_SECRET 环境变量，则为可选
    }),
  ],
})
export class AppModule {}
```

## 使用

注入 `HashService` 来对密码进行哈希处理和验证。

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";

@Injectable()
export class AuthService {
  constructor(private readonly hashService: HashService) {}

  async hashPassword(password: string) {
    return await this.hashService.hash(password);
  }

  async validatePassword(password: string, hash: string) {
    return await this.hashService.verify(hash, password);
  }
}
```

Argon2 是一种现代、安全的密码哈希算法。该模块自动处理盐的生成和配置。
