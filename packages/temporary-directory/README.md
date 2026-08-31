# @nest-boot/temporary-directory

Request-context-scoped temporary directories for NestJS applications. Every
request receives an isolated root under the operating system's temporary
directory, and the complete root is removed automatically when the request
context finishes.

## Requirements

- Node.js `>=26.0.0`
- NestJS 12
- `@nest-boot/request-context` 8

## Installation

```bash
pnpm add @nest-boot/temporary-directory @nest-boot/request-context
```

## Module Registration

Import the static global module directly. It does not expose `register()` or
`registerAsync()`.

```typescript
import { TemporaryDirectoryModule } from "@nest-boot/temporary-directory";
import { Module } from "@nestjs/common";

@Module({
  imports: [TemporaryDirectoryModule],
})
export class AppModule {}
```

## Usage

Inject `TemporaryDirectoryService` and call `create()` from work running inside
an active request context:

```typescript
import { TemporaryDirectoryService } from "@nest-boot/temporary-directory";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ImageService {
  constructor(
    private readonly temporaryDirectoryService: TemporaryDirectoryService,
  ) {}

  async process(): Promise<void> {
    const workDirectory = await this.temporaryDirectoryService.create();
    const imageDirectory = await this.temporaryDirectoryService.create("image");

    // Await all work that uses these paths before the request finishes.
  }
}
```

Node.js appends six random characters to each created directory:

```text
<system temp>/nest-boot-XXXXXX/XXXXXX
<system temp>/nest-boot-XXXXXX/image/XXXXXX
```

The optional namespace must match `/^[A-Za-z0-9_-]+$/` and contain at most 64
characters. Empty strings, path separators, dots, whitespace, and Unicode
characters are rejected with a `TypeError`.

The request root, all namespace directories, and their contents are removed
after the request context resolves or rejects. Cleanup starts when the context
finishes, so do not start detached work that continues using a returned path.
Uncatchable termination such as `SIGKILL`, a runtime crash, or power loss can
prevent immediate disposal; keeping roots under the system temporary directory
allows the operating system to apply its normal eventual-cleanup policy.

## Documentation

- [English tutorial](https://github.com/nest-boot/nest-boot/blob/main/apps/docs/content/docs/tutorial/temporary-directory.mdx)
- [简体中文教程](https://github.com/nest-boot/nest-boot/blob/main/apps/docs/content/docs/tutorial/temporary-directory.zh-Hans.mdx)

## License

[MIT](https://github.com/nest-boot/nest-boot/blob/main/LICENSE)
