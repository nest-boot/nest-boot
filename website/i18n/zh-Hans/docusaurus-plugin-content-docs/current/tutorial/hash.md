---
sidebar_position: 1
---

# 哈希

`@nest-boot/hash` 模块提供使用 Argon2 算法的安全密码哈希和验证功能，Argon2 被认为是目前最安全的哈希算法之一。

## 安装

```bash
npm install @nest-boot/hash
# 或
pnpm add @nest-boot/hash
```

## 基本用法

### 模块注册

在应用模块中注册 `HashModule`：

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    HashModule.register({
      secret: "your-secret-key",
    }),
  ],
})
export class AppModule {}
```

### 异步注册

从环境变量或其他异步来源配置：

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HashModule } from "@nest-boot/hash";

@Module({
  imports: [
    ConfigModule.forRoot(),
    HashModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("HASH_SECRET"),
      }),
    }),
  ],
})
export class AppModule {}
```

## 使用 HashService

将 `HashService` 注入到你的服务或控制器中：

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";

@Injectable()
export class AuthService {
  constructor(private readonly hashService: HashService) {}

  async hashPassword(password: string): Promise<string> {
    return this.hashService.create(password);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return this.hashService.verify(hash, password);
  }
}
```

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/hash) 获取详细信息。

## 配置选项

| 选项     | 类型     | 描述                                                                          |
| -------- | -------- | ----------------------------------------------------------------------------- |
| `secret` | `string` | 用于哈希的密钥。如果未提供，将回退到 `HASH_SECRET` 或 `APP_SECRET` 环境变量。 |

## 环境变量

模块支持以下环境变量作为回退：

- `HASH_SECRET` - 密钥的主要回退
- `APP_SECRET` - 密钥的次要回退
