---
sidebar_position: 2
---

# Crypt 模块

`@nest-boot/crypt` 模块提供使用 AES-256-GCM 算法的加密和解密功能，该算法同时提供机密性和真实性保证。

## 安装

```bash
npm install @nest-boot/crypt
# 或
pnpm add @nest-boot/crypt
```

## 基本用法

### 模块注册

在应用模块中注册 `CryptModule`：

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

### 异步注册

从环境变量或其他异步来源配置：

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

## 使用 CryptService

将 `CryptService` 注入到你的服务或控制器中：

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

## 示例：加密用户数据

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
    // 将加密数据保存到数据库
    await this.userRepository.update(userId, { encryptedData: encrypted });
  }

  async getUserData(userId: string): Promise<object> {
    const user = await this.userRepository.findOne(userId);
    const decrypted = await this.cryptService.decrypt(user.encryptedData);
    return JSON.parse(decrypted);
  }
}
```

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/crypt) 获取详细信息。

## 配置选项

| 选项     | 类型     | 描述                                                                                                               |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `secret` | `string` | 用于加密/解密的密钥。如果未提供，将回退到 `CRYPT_SECRET` 或 `APP_SECRET` 环境变量。**必填** - 未设置时会抛出错误。 |

## 环境变量

模块支持以下环境变量作为回退：

- `CRYPT_SECRET` - 密钥的主要回退
- `APP_SECRET` - 密钥的次要回退

## 安全说明

- AES-256-GCM 算法提供认证加密
- 每次加密都会生成唯一的 IV（初始化向量）和盐值
- 加密输出包含 IV、认证标签、加密数据和盐值
- 生产环境中请务必使用强随机生成的密钥
