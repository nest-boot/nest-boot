---
sidebar_position: 15
---

# File Upload

The `@nest-boot/file-upload` module provides file upload handling via S3-compatible storage, with support for presigned POST uploads, direct uploads, and GraphQL integration.

## Installation

```bash
npm install @nest-boot/file-upload @aws-sdk/client-s3 @aws-sdk/s3-presigned-post
# or
pnpm add @nest-boot/file-upload @aws-sdk/client-s3 @aws-sdk/s3-presigned-post
```

## Basic Usage

### Module Registration

Register the `FileUploadModule` with your S3 configuration:

```typescript
import { Module } from "@nestjs/common";
import { FileUploadModule } from "@nest-boot/file-upload";

@Module({
  imports: [
    FileUploadModule.register({
      client: {
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      },
      bucket: "my-uploads",
    }),
  ],
})
export class AppModule {}
```

### Async Registration

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { FileUploadModule } from "@nest-boot/file-upload";

@Module({
  imports: [
    ConfigModule.forRoot(),
    FileUploadModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        client: {
          endpoint: config.get("S3_ENDPOINT"),
          region: config.get("S3_REGION"),
          credentials: {
            accessKeyId: config.get("AWS_ACCESS_KEY_ID"),
            secretAccessKey: config.get("AWS_SECRET_ACCESS_KEY"),
          },
        },
        bucket: config.get("S3_BUCKET"),
      }),
    }),
  ],
})
export class AppModule {}
```

## Using FileUploadService

### Presigned Upload (Client-Side)

Create presigned POST URLs for client-side uploads:

```typescript
import { Injectable } from "@nestjs/common";
import { FileUploadService } from "@nest-boot/file-upload";

@Injectable()
export class UploadService {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async getUploadUrl(filename: string, mimeType: string, fileSize: number) {
    const [upload] = await this.fileUploadService.create([
      { name: filename, mimeType, fileSize },
    ]);

    return upload; // { url, fields }
  }

  async persistFile(tmpUrl: string) {
    // Move from tmp/ to files/ for permanent storage
    return this.fileUploadService.persist(tmpUrl);
  }
}
```

### Direct Upload (Server-Side)

Upload files directly from the server:

```typescript
import { Injectable } from "@nestjs/common";
import { FileUploadService } from "@nest-boot/file-upload";
import { createReadStream } from "fs";

@Injectable()
export class ImportService {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async uploadReport(content: string) {
    const url = await this.fileUploadService.upload(
      content,
      { "Content-Type": "text/csv", extension: "csv" },
      true, // persist immediately
    );

    return url;
  }
}
```

## File Limits

Configure upload size and type restrictions:

```typescript
FileUploadModule.register({
  client: {
    /* ... */
  },
  bucket: "my-uploads",
  limits: [
    { fileSize: 5 * 1024 * 1024, mimeTypes: ["image/*"] }, // 5 MB for images
    { fileSize: 50 * 1024 * 1024, mimeTypes: ["application/pdf"] }, // 50 MB for PDFs
    { fileSize: 1024 * 1024, mimeTypes: ["text/*"] }, // 1 MB for text
  ],
});
```

## Configuration Options

| Option    | Type                 | Description                                         |
| --------- | -------------------- | --------------------------------------------------- |
| `client`  | `S3Client \| object` | S3Client instance or S3ClientConfig options         |
| `bucket`  | `string`             | S3 bucket name                                      |
| `url`     | `string`             | Custom URL origin for presigned URLs                |
| `expires` | `number`             | Presigned URL expiration in seconds (default: 3600) |
| `limits`  | `object[]`           | File size and MIME type restrictions                |

## Storage Layout

Files are organized automatically:

- **Temporary**: `tmp/{uuid}.{ext}` — Presigned uploads land here
- **Permanent**: `files/{YYYY/MM/DD}/{uuid}.{ext}` — After calling `persist()`

## API Reference

See the full [API documentation](/docs/api/@nest-boot/file-upload) for detailed information.

## Features

- **S3 Compatible** - Works with AWS S3, MinIO, CloudFlare R2, and other S3-compatible services
- **Presigned Uploads** - Secure client-side uploads via presigned POST
- **Direct Uploads** - Server-side upload from streams, buffers, or strings
- **File Persistence** - Two-phase upload: temporary → permanent
- **Size Limits** - Configurable per-MIME-type size restrictions
- **GraphQL Resolver** - Built-in GraphQL mutation for file uploads
