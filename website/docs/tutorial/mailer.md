---
sidebar_position: 13
---

# Mailer

The `@nest-boot/mailer` module provides email sending functionality powered by [Nodemailer](https://nodemailer.com/).

## Installation

```bash
npm install @nest-boot/mailer nodemailer
# or
pnpm add @nest-boot/mailer nodemailer
```

## Basic Usage

### Module Registration

Register the `MailerModule` with SMTP configuration:

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

### Async Registration

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

## Sending Emails

Inject the Nodemailer `Mailer` instance directly:

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
      subject: `Welcome, ${name}!`,
      text: `Hi ${name}, thanks for signing up.`,
      html: `<p>Hi <strong>${name}</strong>, thanks for signing up.</p>`,
    });
  }

  async sendPasswordReset(to: string, resetLink: string) {
    await this.mailer.sendMail({
      from: '"App" <noreply@example.com>',
      to,
      subject: "Password Reset",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });
  }
}
```

## Using with View Module

Combine with `@nest-boot/view` for Handlebars email templates:

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
      subject: "Welcome",
      html,
    });
  }
}
```

## Configuration Options

All [Nodemailer transport options](https://nodemailer.com/smtp/) are supported, including:

| Option   | Type      | Description                        |
| -------- | --------- | ---------------------------------- |
| `host`   | `string`  | SMTP server hostname               |
| `port`   | `number`  | SMTP server port (25, 465, or 587) |
| `secure` | `boolean` | Use TLS (true for port 465)        |
| `auth`   | `object`  | Authentication credentials         |
| `tls`    | `object`  | TLS options                        |

## API Reference

See the full [API documentation](/docs/api/@nest-boot/mailer) for detailed information.

## Features

- **Nodemailer Integration** - Full Nodemailer API with NestJS DI
- **SMTP Support** - Standard SMTP transport configuration
- **Template Support** - Combine with ViewModule for HTML templates
- **Async Config** - Factory-based configuration from environment or config service
