---
sidebar_position: 16
---

# 验证器

`@nest-boot/validator` 模块提供基于 [class-validator](https://github.com/typestack/class-validator) 的增强验证装饰器集合，支持 i18n 错误消息和本地化验证消息构建工具。

## 安装

```bash
npm install @nest-boot/validator class-validator class-transformer
# 或
pnpm add @nest-boot/validator class-validator class-transformer
```

## 基本用法

在 DTO 类上使用验证装饰器：

```typescript
import {
  IsEmail,
  IsUrl,
  Length,
  Min,
  Max,
  IsOptional,
} from "@nest-boot/validator";

export class CreateUserDto {
  @Length(2, 50)
  name!: string;

  @IsEmail()
  email!: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @Min(0)
  @Max(120)
  age!: number;
}
```

## 可用装饰器

### 字符串验证

| 装饰器              | 描述               |
| ------------------- | ------------------ |
| `@IsDomain()`       | 验证域名           |
| `@IsEmail()`        | 验证邮箱地址       |
| `@IsNumberString()` | 验证数字字符串     |
| `@IsTimezone()`     | 验证时区字符串     |
| `@IsUrl()`          | 验证 URL           |
| `@Length(min, max)` | 验证字符串长度范围 |

### 数字验证

| 装饰器                         | 描述         |
| ------------------------------ | ------------ |
| `@Min(value)`                  | 验证最小值   |
| `@Max(value)`                  | 验证最大值   |
| `@IsGreaterThan(value)`        | 验证严格大于 |
| `@IsGreaterThanOrEqual(value)` | 验证大于等于 |
| `@IsLessThan(value)`           | 验证严格小于 |
| `@IsLessThanOrEqual(value)`    | 验证小于等于 |

### 通用验证

| 装饰器                   | 描述             |
| ------------------------ | ---------------- |
| `@ArrayLength(min, max)` | 验证数组长度范围 |
| `@IsOptional()`          | 标记属性为可选   |
| `@ValidateNested()`      | 验证嵌套对象     |
| `@IsDate()`              | 验证日期值       |

## i18n 支持

所有装饰器通过 `buildI18nMessage` 工具支持 i18n 错误消息：

```typescript
import { Length, IsEmail } from "@nest-boot/validator";

export class CreateUserDto {
  @Length(2, 50) // 错误: "name must be between 2 and 50 characters"
  name!: string;

  @IsEmail() // 错误: "email must be an email"
  email!: string;
}
```

错误消息自动使用属性名和约束值格式化，方便 i18n 翻译。

## NestJS 集成

在主应用中启用全局验证管道：

```typescript
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/validator) 获取详细信息。

## 特性

- **增强装饰器** - 改进的验证装饰器，提供一致的错误消息
- **i18n 就绪** - 错误消息格式化以支持国际化
- **class-validator 兼容** - 与 class-validator 生态完全兼容
- **类型安全** - TypeScript 优先的验证，提供正确的类型推断
- **便捷导出** - 方便的 `IsOptional` 和 `ValidateNested` 重导出
