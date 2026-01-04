---
sidebar_position: 2
---

# Crypt

The `@nest-boot/crypt` module provides encryption and decryption functionality using the AES-256-GCM algorithm, which provides both confidentiality and authenticity guarantees.

## Installation

```bash
npm install @nest-boot/crypt
# or
pnpm add @nest-boot/crypt
```

## Basic Usage

### Module Registration

Register the `CryptModule` in your application module:

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    CryptModule.register({
      secret: "your-secret-key",
    }),
  ],
})
export class AppModule {}
```

### Async Registration

For configuration from environment variables or other async sources:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    ConfigModule.forRoot(),
    CryptModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("CRYPT_SECRET"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Using CryptService

Inject the `CryptService` into your service or controller:

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";

@Injectable()
export class DataService {
  constructor(private readonly cryptService: CryptService) {}

  async encryptSensitiveData(data: string): Promise<string> {
    return this.cryptService.encrypt(data);
  }

  async decryptSensitiveData(encrypted: string): Promise<string> {
    return this.cryptService.decrypt(encrypted);
  }
}
```

## Example: Encrypting User Data

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";

@Injectable()
export class UserService {
  constructor(private readonly cryptService: CryptService) {}

  async saveUserData(userId: string, sensitiveData: object): Promise<void> {
    const encrypted = await this.cryptService.encrypt(
      JSON.stringify(sensitiveData),
    );
    // Save encrypted data to database
    await this.userRepository.update(userId, { encryptedData: encrypted });
  }

  async getUserData(userId: string): Promise<object> {
    const user = await this.userRepository.findOne(userId);
    const decrypted = await this.cryptService.decrypt(user.encryptedData);
    return JSON.parse(decrypted);
  }
}
```

## API Reference

See the full [API documentation](/docs/api/@nest-boot/crypt) for detailed information.

## Configuration Options

| Option   | Type     | Description                                                                                                                                                                |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secret` | `string` | The secret key used for encryption/decryption. Falls back to `CRYPT_SECRET` or `APP_SECRET` environment variables if not provided. **Required** - throws error if not set. |

## Environment Variables

The module supports the following environment variables as fallbacks:

- `CRYPT_SECRET` - Primary fallback for the secret key
- `APP_SECRET` - Secondary fallback for the secret key

## Security Notes

- The AES-256-GCM algorithm provides authenticated encryption
- Each encryption generates a unique IV (Initialization Vector) and salt
- The encrypted output includes the IV, authentication tag, encrypted data, and salt
- Always use a strong, randomly generated secret key in production
