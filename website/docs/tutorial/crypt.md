---
sidebar_position: 1
---

# Crypt

The `@nest-boot/crypt` module provides utilities for encryption and decryption using JWE (JSON Web Encryption) with the `jose` library.

## Installation

```bash
npm install @nest-boot/crypt jose
# or
pnpm add @nest-boot/crypt jose
```

## Setup

Register the `CryptModule` in your application module.

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    CryptModule.register({
      // secret: process.env.CRYPT_SECRET, // Optional if CRYPT_SECRET or APP_SECRET env var is set
    }),
  ],
})
export class AppModule {}
```

## Usage

Inject `CryptService` to encrypt and decrypt data.

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";

@Injectable()
export class SecretService {
  constructor(private readonly cryptService: CryptService) {}

  async saveSecret(data: string) {
    const encrypted = await this.cryptService.encrypt(data);
    // save encrypted data...
    return encrypted;
  }

  async getSecret(encryptedData: string) {
    const decrypted = await this.cryptService.decrypt(encryptedData);
    return decrypted;
  }
}
```

The module uses HKDF to derive keys from your secret, ensuring secure encryption regardless of the secret length (though longer is better). It uses `A256GCMKW` for key wrapping and `A256GCM` for content encryption.
