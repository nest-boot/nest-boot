---
sidebar_position: 17
---

# View

The `@nest-boot/view` module provides server-side template rendering using [Handlebars](https://handlebarsjs.com/), with automatic template discovery and registration.

## Installation

```bash
npm install @nest-boot/view handlebars
# or
pnpm add @nest-boot/view handlebars
```

## Basic Usage

### Module Registration

Register the `ViewModule` with template directory paths:

```typescript
import { Module } from "@nestjs/common";
import { ViewModule } from "@nest-boot/view";

@Module({
  imports: [
    ViewModule.register({
      path: ["views"],
    }),
  ],
})
export class AppModule {}
```

### Async Registration

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ViewModule } from "@nest-boot/view";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ViewModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        path: [config.get("VIEWS_PATH", "views")],
      }),
    }),
  ],
})
export class AppModule {}
```

## Template Files

Create Handlebars templates in your views directory:

```
project/
├── views/
│   ├── emails/
│   │   ├── welcome.hbs
│   │   └── reset-password.hbs
│   └── reports/
│       └── daily.hbs
└── src/
```

Template names are derived from the relative path with dots as separators:

- `views/emails/welcome.hbs` → `emails.welcome`
- `views/reports/daily.hbs` → `reports.daily`

## Rendering Templates

Inject `ViewService` to render templates:

```typescript
import { Injectable } from "@nestjs/common";
import { ViewService } from "@nest-boot/view";

@Injectable()
export class EmailService {
  constructor(private readonly viewService: ViewService) {}

  renderWelcomeEmail(name: string, activationLink: string): string {
    return this.viewService.render("emails.welcome", {
      name,
      activationLink,
    });
  }

  renderReport(data: object): string {
    return this.viewService.render("reports.daily", data);
  }
}
```

## Example Template

`views/emails/welcome.hbs`:

```handlebars
<html>
  <body>
    <h1>Welcome, {{name}}!</h1>
    <p>Thanks for signing up. Click below to activate your account:</p>
    <a href="{{activationLink}}">Activate Account</a>
  </body>
</html>
```

## Using with Mailer

Combine with `@nest-boot/mailer` for templated emails:

```typescript
import { Injectable } from "@nestjs/common";
import Mailer from "nodemailer/lib/mailer";
import { ViewService } from "@nest-boot/view";

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailer: Mailer,
    private readonly viewService: ViewService,
  ) {}

  async sendWelcome(to: string, name: string) {
    const html = this.viewService.render("emails.welcome", { name });

    await this.mailer.sendMail({
      from: '"App" <noreply@example.com>',
      to,
      subject: "Welcome!",
      html,
    });
  }
}
```

## Configuration Options

| Option | Type       | Description                                              |
| ------ | ---------- | -------------------------------------------------------- |
| `path` | `string[]` | Directories to scan for templates (default: `["views"]`) |

## API Reference

See the full [API documentation](/docs/api/@nest-boot/view) for detailed information.

## Features

- **Handlebars Templates** - Full Handlebars syntax with helpers and partials
- **Auto Discovery** - Automatically finds `.hbs` and `.handlebars` files
- **Dot Notation** - Templates named by directory path (e.g., `emails.welcome`)
- **Programmatic Registration** - Register templates dynamically via `ViewService`
- **Multi-Directory** - Support for multiple template directories
