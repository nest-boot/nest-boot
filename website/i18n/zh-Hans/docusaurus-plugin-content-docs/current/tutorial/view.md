---
sidebar_position: 17
---

# 视图

`@nest-boot/view` 模块使用 [Handlebars](https://handlebarsjs.com/) 提供服务端模板渲染，支持自动模板发现和注册。

## 安装

```bash
npm install @nest-boot/view handlebars
# 或
pnpm add @nest-boot/view handlebars
```

## 基本用法

### 模块注册

使用模板目录路径注册 `ViewModule`：

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

### 异步注册

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

## 模板文件

在 views 目录中创建 Handlebars 模板：

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

模板名称由相对路径派生，使用点号作为分隔符：

- `views/emails/welcome.hbs` → `emails.welcome`
- `views/reports/daily.hbs` → `reports.daily`

## 渲染模板

注入 `ViewService` 渲染模板：

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

## 模板示例

`views/emails/welcome.hbs`：

```handlebars
<html>
  <body>
    <h1>欢迎, {{name}}!</h1>
    <p>感谢注册。点击下方链接激活你的账户：</p>
    <a href="{{activationLink}}">激活账户</a>
  </body>
</html>
```

## 配合邮件模块使用

与 `@nest-boot/mailer` 结合发送模板邮件：

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
      subject: "欢迎!",
      html,
    });
  }
}
```

## 配置选项

| 选项   | 类型       | 描述                                |
| ------ | ---------- | ----------------------------------- |
| `path` | `string[]` | 扫描模板的目录（默认：`["views"]`） |

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/view) 获取详细信息。

## 特性

- **Handlebars 模板** - 完整的 Handlebars 语法，支持 helper 和 partial
- **自动发现** - 自动查找 `.hbs` 和 `.handlebars` 文件
- **点号命名** - 按目录路径命名模板（如 `emails.welcome`）
- **编程注册** - 通过 `ViewService` 动态注册模板
- **多目录** - 支持多个模板目录
