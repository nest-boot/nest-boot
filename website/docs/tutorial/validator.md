---
sidebar_position: 16
---

# Validator

The `@nest-boot/validator` module provides a collection of enhanced validation decorators built on [class-validator](https://github.com/typestack/class-validator), with i18n-ready error messages and a utility for building localized validation messages.

## Installation

```bash
npm install @nest-boot/validator class-validator class-transformer
# or
pnpm add @nest-boot/validator class-validator class-transformer
```

## Basic Usage

Use the validation decorators on your DTO classes:

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

## Available Decorators

### String Validators

| Decorator           | Description                   |
| ------------------- | ----------------------------- |
| `@IsDomain()`       | Validates domain names        |
| `@IsEmail()`        | Validates email addresses     |
| `@IsNumberString()` | Validates numeric strings     |
| `@IsTimezone()`     | Validates timezone strings    |
| `@IsUrl()`          | Validates URLs                |
| `@Length(min, max)` | Validates string length range |

### Number Validators

| Decorator                      | Description                              |
| ------------------------------ | ---------------------------------------- |
| `@Min(value)`                  | Validates minimum value                  |
| `@Max(value)`                  | Validates maximum value                  |
| `@IsGreaterThan(value)`        | Validates value is strictly greater than |
| `@IsGreaterThanOrEqual(value)` | Validates value is greater than or equal |
| `@IsLessThan(value)`           | Validates value is strictly less than    |
| `@IsLessThanOrEqual(value)`    | Validates value is less than or equal    |

### Common Validators

| Decorator                | Description                  |
| ------------------------ | ---------------------------- |
| `@ArrayLength(min, max)` | Validates array length range |
| `@IsOptional()`          | Marks property as optional   |
| `@ValidateNested()`      | Validates nested objects     |
| `@IsDate()`              | Validates date values        |

## i18n Support

All decorators support i18n-ready error messages via the `buildI18nMessage` utility:

```typescript
import { Length, IsEmail } from "@nest-boot/validator";

export class CreateUserDto {
  @Length(2, 50) // Error: "name must be between 2 and 50 characters"
  name!: string;

  @IsEmail() // Error: "email must be an email"
  email!: string;
}
```

Error messages are automatically formatted with the property name and constraint values, ready for i18n translation.

## NestJS Integration

Enable the global validation pipe in your main application:

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

## API Reference

See the full [API documentation](/docs/api/@nest-boot/validator) for detailed information.

## Features

- **Enhanced Decorators** - Improved validation decorators with consistent error messages
- **i18n Ready** - Error messages formatted for internationalization
- **class-validator Compatible** - Full compatibility with class-validator ecosystem
- **Type-Safe** - TypeScript-first validation with proper type inference
- **Re-exports** - Convenient re-exports of `IsOptional` and `ValidateNested`
