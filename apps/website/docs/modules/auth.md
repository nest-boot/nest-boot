---
sidebar_position: 6
---

# 认证

Nest Boot 带有一个身份验证系统，可以使用 Cookie 或 API 令牌对您的应用程序的用户进行身份验证。
使用身份认证需要单独安装 `@nest-boot/auth` 扩展模块。

## 安装

```shell
npm i @nest-boot/auth
```

## 使用

1. 认证模块需要先创建一个 MikroORM 的个人访问令牌实体类：

   ```typescript
   // ./user-auth/personal-access-token.entity.ts
   import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
   import { PersonalAccessTokenInterface } from "@nest-boot/auth";
   import { ObjectType } from "@nestjs/graphql";

   @ObjectType()
   @Entity()
   export class PersonalAccessToken implements PersonalAccessTokenInterface {
     @PrimaryKey({ type: "uuid", defaultRaw: "uuid_generate_v4()" })
     id!: string;

     @Property()
     name!: string;

     @Property({ unique: true })
     token!: string;

     @Property()
     entityId!: string;

     @Property()
     entityName!: string;

     @Property()
     expiresAt?: Date;

     @Property()
     lastUsedAt?: Date;

     @Property({ defaultRaw: "now()" })
     createdAt!: Date;

     @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
     updatedAt!: Date;
   }
   ```

2. 添加 `AuthController` 控制器声明登录和登出路由：

   ```typescript
   // ./user-auth/auth.controller.ts
   import { AuthService } from "@nest-boot/auth";
   import { Body, Controller, HttpCode, Post } from "@nestjs/common";

   import { User } from "../user/user.entity";
   import { PersonalAccessToken } from "./personal-access-token.entity";

   @Controller("auth")
   export class UserController {
     constructor(private readonly authService: AuthService) {}

     @Post("login")
     async login(
       @Body("email") email: string,
       @Body("password") password: string
     ): Promise<{ user: User; token: PersonalAccessToken }> {
       const token = await this.authService.login(email, password);
       return { user: await token.user.load(), token };
     }

     @HttpCode(201)
     @Post("logout")
     async logout(): Promise<void> {
       await this.authService.logout();
     }
   }
   ```

3. 然后在 `AppModule` 中导入 `AuthModule` 并配置相关参数：

   ```typescript
   // ./app.module.ts
   import { Module } from "@nestjs/common";
   import { AuthModule } from "@nest-boot/auth";
   import { PersonalAccessToken } from "./user-auth/personal-access-token.entity";

   @Module({
     imports: [
       AuthModule.register({
         personalAccessTokenEntityClass: PersonalAccessToken,
       }),
     ],
   })
   export class AppModule {}
   ```

## 权限
