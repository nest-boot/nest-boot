---
sidebar_position: 1
---

# Crypt

`@nest-boot/crypt` 模块使用 `jose` 库提供基于 JWE (JSON Web Encryption) 的加密和解密工具。

## 安装

```bash
npm install @nest-boot/crypt jose
# or
pnpm add @nest-boot/crypt jose
```

## 配置

在你的应用程序模块中注册 `CryptModule`。

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    CryptModule.register({
      // secret: process.env.CRYPT_SECRET, // 如果设置了 CRYPT_SECRET 或 APP_SECRET 环境变量，则为可选
    }),
  ],
})
export class AppModule {}
```

## 使用

注入 `CryptService` 来加密和解密数据。

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";

@Injectable()
export class SecretService {
  constructor(private readonly cryptService: CryptService) {}

  async saveSecret(data: string) {
    const encrypted = await this.cryptService.encrypt(data);
    // 保存加密数据...
    return encrypted;
  }

  async getSecret(encryptedData: string) {
    const decrypted = await this.cryptService.decrypt(encryptedData);
    return decrypted;
  }
}
```

该模块使用 HKDF 从你的密钥派生密钥，确保无论密钥长度如何（尽管越长越好）都能进行安全加密。它使用 `A256GCMKW` 进行密钥包装，使用 `A256GCM` 进行内容加密。
