---
sidebar_position: 13
---

# 邮件

`@nest-boot/mailer` 模块提供基于 [Nodemailer](https://nodemailer.com/) 的邮件发送功能。

## 安装

```bash
npm install @nest-boot/mailer nodemailer
# 或
pnpm add @nest-boot/mailer nodemailer
```

## 基本用法

### 模块注册

使用 SMTP 配置注册 `MailerModule`：

```typescript
import { Module } from "@nestjs/common";
import { MailerModule } from "@nest-boot/mailer";

@Module({
  imports: [
    MailerModule.register({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "user@example.com",
        pass: "password",
      },
    }),
  ],
})
export class AppModule {}
```

### 异步注册

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailerModule } from "@nest-boot/mailer";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MailerModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.get("SMTP_HOST"),
        port: config.get("SMTP_PORT"),
        auth: {
          user: config.get("SMTP_USER"),
          pass: config.get("SMTP_PASS"),
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## 发送邮件

直接注入 Nodemailer `Mailer` 实例：

```typescript
import { Injectable } from "@nestjs/common";
import Mailer from "nodemailer/lib/mailer";

@Injectable()
export class NotificationService {
  constructor(private readonly mailer: Mailer) {}

  async sendWelcomeEmail(to: string, name: string) {
    await this.mailer.sendMail({
      from: '"App" <noreply@example.com>',
      to,
      subject: `欢迎, ${name}!`,
      text: `你好 ${name}, 感谢注册。`,
      html: `<p>你好 <strong>${name}</strong>, 感谢注册。</p>`,
    });
  }

  async sendPasswordReset(to: string, resetLink: string) {
    await this.mailer.sendMail({
      from: '"App" <noreply@example.com>',
      to,
      subject: "重置密码",
      html: `<p>点击 <a href="${resetLink}">这里</a> 重置你的密码。</p>`,
    });
  }
}
```

## 配合视图模块使用

与 `@nest-boot/view` 结合使用 Handlebars 邮件模板：

```typescript
import { Injectable } from "@nestjs/common";
import Mailer from "nodemailer/lib/mailer";
import { ViewService } from "@nest-boot/view";

@Injectable()
export class EmailService {
  constructor(
    private readonly mailer: Mailer,
    private readonly viewService: ViewService,
  ) {}

  async sendTemplatedEmail(to: string, data: object) {
    const html = this.viewService.render("emails.welcome", data);

    await this.mailer.sendMail({
      from: '"App" <noreply@example.com>',
      to,
      subject: "欢迎",
      html,
    });
  }
}
```

## 配置选项

支持所有 [Nodemailer transport 选项](https://nodemailer.com/smtp/)，包括：

| 选项     | 类型      | 描述                           |
| -------- | --------- | ------------------------------ |
| `host`   | `string`  | SMTP 服务器主机名              |
| `port`   | `number`  | SMTP 服务器端口 (25, 465, 587) |
| `secure` | `boolean` | 使用 TLS（端口 465 时为 true） |
| `auth`   | `object`  | 认证凭据                       |
| `tls`    | `object`  | TLS 选项                       |

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/mailer) 获取详细信息。

## 特性

- **Nodemailer 集成** - 通过 NestJS 依赖注入使用完整的 Nodemailer API
- **SMTP 支持** - 标准 SMTP transport 配置
- **模板支持** - 与 ViewModule 结合使用 HTML 模板
- **异步配置** - 基于工厂函数的配置，支持环境变量或配置服务
