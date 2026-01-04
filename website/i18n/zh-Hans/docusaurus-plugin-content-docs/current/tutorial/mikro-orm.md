---
sidebar_position: 3
---

# MikroORM

`@nest-boot/mikro-orm` 模块提供与 [MikroORM](https://mikro-orm.io/) 的无缝集成，MikroORM 是一个用于 Node.js 的 TypeScript ORM。该模块包含从环境变量自动配置、请求上下文集成，以及对加密和哈希实体属性的支持。

## 安装

```bash
npm install @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/reflection
# 或
pnpm add @nest-boot/mikro-orm @mikro-orm/core @mikro-orm/reflection
```

你还需要安装数据库驱动：

```bash
# PostgreSQL
pnpm add @mikro-orm/postgresql

# MySQL
pnpm add @mikro-orm/mysql
```

## 基本用法

### 模块注册

在应用模块中注册 `MikroOrmModule`：

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    MikroOrmModule.register({
      entities: ["dist/**/*.entity.js"],
      entitiesTs: ["src/**/*.entity.ts"],
    }),
  ],
})
export class AppModule {}
```

### 使用环境变量

如果未提供选项，模块会自动从环境变量加载配置：

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    // 将使用 DB_* 或 DATABASE_* 环境变量
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### 异步注册

从其他服务获取配置：

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MikroOrmModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        clientUrl: config.get("DATABASE_URL"),
      }),
    }),
  ],
})
export class AppModule {}
```

## 注册实体

使用 `MikroOrmModule.forFeature()` 为特定模块注册实体：

```typescript
import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  providers: [UserService],
})
export class UserModule {}
```

## 环境变量

模块支持从以下环境变量自动配置：

| 变量                                          | 描述                                            |
| --------------------------------------------- | ----------------------------------------------- |
| `DB_URL` 或 `DATABASE_URL`                    | 完整的数据库连接 URL（优先级最高）              |
| `DB_TYPE` 或 `DATABASE_TYPE`                  | 数据库类型（`mysql`、`postgres`、`postgresql`） |
| `DB_HOST` 或 `DATABASE_HOST`                  | 数据库服务器主机名                              |
| `DB_PORT` 或 `DATABASE_PORT`                  | 数据库服务器端口                                |
| `DB_NAME` 或 `DB_DATABASE` 或 `DATABASE_NAME` | 数据库名称                                      |
| `DB_USER` 或 `DB_USERNAME` 或 `DATABASE_USER` | 数据库用户名                                    |
| `DB_PASS` 或 `DB_PASSWORD` 或 `DATABASE_PASS` | 数据库密码                                      |

## 默认配置

模块提供合理的默认值：

- **Dataloader**：为所有关系启用
- **时区**：UTC
- **元数据提供者**：TsMorphMetadataProvider
- **实体路径**：`dist/**/*.entity.js` / `src/**/*.entity.ts`
- **迁移路径**：`dist/database/migrations` / `src/database/migrations`
- **种子路径**：`dist/database/seeders` / `src/database/seeders`

## 加密字段

`@nest-boot/mikro-orm-crypt` 包提供一个装饰器，用于在实体属性持久化到数据库之前自动加密。

### 使用场景

加密适用于需要以原始形式检索的敏感数据：

- **个人身份信息 (PII)**：身份证号、社保号、护照号
- **金融数据**：信用卡号、银行账号
- **医疗记录**：健康信息、病史
- **联系方式**：电话号码、地址（需要保护隐私时）
- **API 密钥和令牌**：按用户存储的第三方服务凭证
- **私密备注**：包含敏感内容的用户备注或评论

### 安装

```bash
npm install @nest-boot/mikro-orm-crypt @nest-boot/crypt
# 或
pnpm add @nest-boot/mikro-orm-crypt @nest-boot/crypt
```

### 用法

使用 `@EncryptedProperty()` 装饰器标记需要加密的属性：

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { EncryptedProperty } from "@nest-boot/mikro-orm-crypt";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @EncryptedProperty({ type: t.string })
  ssn!: string;

  @EncryptedProperty({ type: t.text })
  creditCard!: string;
}
```

### 工作原理

- 使用 `@EncryptedProperty()` 标记的属性会在 `create` 和 `update` 操作前自动加密
- 加密使用 `@nest-boot/crypt` 提供的 AES-256-GCM 算法
- 已加密的值（JWE 格式）会被跳过，防止重复加密
- 属性默认标记为 `hidden: true` 和 `lazy: true`

### 配置

确保使用密钥配置 `CryptModule`：

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### 解密数据

使用 `CryptService` 解密加密字段：

```typescript
import { Injectable } from "@nestjs/common";
import { CryptService } from "@nest-boot/crypt";
import { EntityManager } from "@mikro-orm/core";
import { User } from "./entities/user.entity";

@Injectable()
export class UserService {
  constructor(
    private readonly em: EntityManager,
    private readonly cryptService: CryptService,
  ) {}

  async getUserSSN(userId: number): Promise<string> {
    const user = await this.em.findOneOrFail(User, userId);
    return this.cryptService.decrypt(user.ssn);
  }
}
```

## 哈希字段

`@nest-boot/mikro-orm-hash` 包提供一个装饰器，用于在实体属性（如密码）持久化到数据库之前自动哈希。

### 使用场景

哈希适用于只需要验证而不需要检索原始值的数据：

- **密码**：用户登录密码、管理员密码
- **PIN 码**：支付 PIN、访问 PIN
- **安全问题答案**：密保问题的答案
- **验证码**：需要验证的一次性验证码

> **注意**：与加密不同，哈希是单向操作。你无法从哈希值还原原始值。当你只需要验证输入是否与存储的值匹配时，使用哈希。

### 安装

```bash
npm install @nest-boot/mikro-orm-hash @nest-boot/hash
# 或
pnpm add @nest-boot/mikro-orm-hash @nest-boot/hash
```

### 用法

使用 `@HashedProperty()` 装饰器标记需要哈希的属性：

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { HashedProperty } from "@nest-boot/mikro-orm-hash";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @HashedProperty({ type: t.string })
  password!: string;
}
```

### 工作原理

- 使用 `@HashedProperty()` 标记的属性会在 `create` 和 `update` 操作前自动哈希
- 哈希使用 `@nest-boot/hash` 提供的 Argon2 算法
- 已哈希的值（以 `$argon2` 开头）会被跳过，防止重复哈希
- 属性默认标记为 `hidden: true` 和 `lazy: true`

### 配置

确保使用密钥配置 `HashModule`：

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";
import { MikroOrmModule } from "@nest-boot/mikro-orm";

@Module({
  imports: [
    HashModule.register({
      secret: process.env.HASH_SECRET,
    }),
    MikroOrmModule.register({}),
  ],
})
export class AppModule {}
```

### 验证密码

使用 `HashService` 验证密码：

```typescript
import { Injectable } from "@nestjs/common";
import { HashService } from "@nest-boot/hash";
import { EntityManager } from "@mikro-orm/core";
import { User } from "./entities/user.entity";

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly hashService: HashService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.em.findOne(User, { email });

    if (user && (await this.hashService.verify(user.password, password))) {
      return user;
    }

    return null;
  }
}
```

## 完整示例

以下是结合加密和哈希属性的完整示例：

```typescript
import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { EncryptedProperty } from "@nest-boot/mikro-orm-crypt";
import { HashedProperty } from "@nest-boot/mikro-orm-hash";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @HashedProperty({ type: t.string })
  password!: string;

  @EncryptedProperty({ type: t.string, nullable: true })
  ssn?: string;

  @EncryptedProperty({ type: t.text, nullable: true })
  notes?: string;
}
```

```typescript
import { Module } from "@nestjs/common";
import { CryptModule } from "@nest-boot/crypt";
import { HashModule } from "@nest-boot/hash";
import { MikroOrmModule } from "@nest-boot/mikro-orm";
import { User } from "./entities/user.entity";

@Module({
  imports: [
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
    HashModule.register({
      secret: process.env.HASH_SECRET,
    }),
    MikroOrmModule.register({}),
    MikroOrmModule.forFeature([User]),
  ],
})
export class AppModule {}
```

## API 参考

查看完整的 API 文档获取详细信息：

- [@nest-boot/mikro-orm](/docs/api/@nest-boot/mikro-orm)
- [@nest-boot/mikro-orm-crypt](/docs/api/@nest-boot/mikro-orm-crypt)
- [@nest-boot/mikro-orm-hash](/docs/api/@nest-boot/mikro-orm-hash)

## 特性

- **自动配置** - 自动从环境变量加载设置
- **请求上下文集成** - 每个请求自动 fork EntityManager
- **加密属性** - 自动使用 AES-256-GCM 加密敏感数据
- **哈希属性** - 自动使用 Argon2 哈希密码
- **TsMorph 元数据** - 基于反射的元数据提供者
- **Dataloader 支持** - 内置 dataloader 优化关系加载
