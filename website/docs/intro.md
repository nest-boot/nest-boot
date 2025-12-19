---
sidebar_position: 1
---

# Introduction

Nest Boot is a modular framework for building NestJS applications. It provides a collection of reusable modules that help you build robust, scalable applications faster.

## Features

- **Modular Architecture** - Pick and choose only the modules you need
- **TypeScript First** - Built with TypeScript for type safety and better developer experience
- **Production Ready** - Battle-tested modules used in production applications
- **Well Documented** - Comprehensive documentation with examples

## Modules

Nest Boot provides the following modules:

| Module                                                                   | Description                         |
| ------------------------------------------------------------------------ | ----------------------------------- |
| [@nest-boot/auth](/docs/api/@nest-boot/auth)                             | Authentication and authorization    |
| [@nest-boot/bullmq](/docs/api/@nest-boot/bullmq)                         | Job queue management with BullMQ    |
| [@nest-boot/crypt](/docs/tutorial/crypt)                                 | Encryption and decryption utilities |
| [@nest-boot/graphql](/docs/api/@nest-boot/graphql)                       | GraphQL integration                 |
| [@nest-boot/graphql-connection](/docs/api/@nest-boot/graphql-connection) | GraphQL connection/pagination       |
| [@nest-boot/hash](/docs/tutorial/hash)                                   | Password hashing utilities          |
| [@nest-boot/i18n](/docs/api/@nest-boot/i18n)                             | Internationalization                |
| [@nest-boot/logger](/docs/api/@nest-boot/logger)                         | Logging utilities                   |
| [@nest-boot/mailer](/docs/api/@nest-boot/mailer)                         | Email sending                       |
| [@nest-boot/metrics](/docs/api/@nest-boot/metrics)                       | Application metrics                 |
| [@nest-boot/middleware](/docs/tutorial/middleware)                       | Middleware management               |
| [@nest-boot/mikro-orm](/docs/api/@nest-boot/mikro-orm)                   | MikroORM integration                |
| [@nest-boot/redis](/docs/tutorial/redis)                                 | Redis client                        |
| [@nest-boot/request-context](/docs/api/@nest-boot/request-context)       | Request context management          |
| [@nest-boot/schedule](/docs/api/@nest-boot/schedule)                     | Task scheduling                     |
| [@nest-boot/validator](/docs/api/@nest-boot/validator)                   | Validation utilities                |
| [@nest-boot/view](/docs/api/@nest-boot/view)                             | View rendering                      |

## Quick Start

Install the modules you need:

```bash
npm install @nest-boot/hash @nest-boot/crypt
# or
pnpm add @nest-boot/hash @nest-boot/crypt
```

Then import and register them in your NestJS application:

```typescript
import { Module } from "@nestjs/common";
import { HashModule } from "@nest-boot/hash";
import { CryptModule } from "@nest-boot/crypt";

@Module({
  imports: [
    HashModule.register(),
    CryptModule.register({
      secret: process.env.CRYPT_SECRET,
    }),
  ],
})
export class AppModule {}
```

## Next Steps

- Browse the [Tutorials](/docs/tutorial/hash) to learn how to use specific modules
- Check out the [API Reference](/docs/api) for detailed documentation
