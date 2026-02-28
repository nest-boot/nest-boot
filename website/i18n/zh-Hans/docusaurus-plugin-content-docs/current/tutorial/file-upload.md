---
sidebar_position: 15
---

# 文件上传

`@nest-boot/file-upload` 模块提供基于 S3 兼容存储的文件上传处理，支持预签名 POST 上传、直接上传和 GraphQL 集成。

## 安装

```bash
npm install @nest-boot/file-upload @aws-sdk/client-s3 @aws-sdk/s3-presigned-post
# 或
pnpm add @nest-boot/file-upload @aws-sdk/client-s3 @aws-sdk/s3-presigned-post
```

## 基本用法

### 模块注册

使用 S3 配置注册 `FileUploadModule`：

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

### 异步注册

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

## 使用 FileUploadService

### 预签名上传（客户端）

创建预签名 POST URL 用于客户端上传：

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
    // 从 tmp/ 移动到 files/ 永久存储
    return this.fileUploadService.persist(tmpUrl);
  }
}
```

### 直接上传（服务端）

从服务端直接上传文件：

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
      true, // 立即持久化
    );

    return url;
  }
}
```

## 文件限制

配置上传大小和类型限制：

```typescript
FileUploadModule.register({
  client: {
    /* ... */
  },
  bucket: "my-uploads",
  limits: [
    { fileSize: 5 * 1024 * 1024, mimeTypes: ["image/*"] }, // 图片 5 MB
    { fileSize: 50 * 1024 * 1024, mimeTypes: ["application/pdf"] }, // PDF 50 MB
    { fileSize: 1024 * 1024, mimeTypes: ["text/*"] }, // 文本 1 MB
  ],
});
```

## 配置选项

| 选项      | 类型                 | 描述                                  |
| --------- | -------------------- | ------------------------------------- |
| `client`  | `S3Client \| object` | S3Client 实例或 S3ClientConfig 选项   |
| `bucket`  | `string`             | S3 存储桶名称                         |
| `url`     | `string`             | 预签名 URL 的自定义 URL 来源          |
| `expires` | `number`             | 预签名 URL 过期时间，秒（默认：3600） |
| `limits`  | `object[]`           | 文件大小和 MIME 类型限制              |

## 存储布局

文件自动组织：

- **临时**：`tmp/{uuid}.{ext}` — 预签名上传的落地位置
- **永久**：`files/{YYYY/MM/DD}/{uuid}.{ext}` — 调用 `persist()` 后

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/file-upload) 获取详细信息。

## 特性

- **S3 兼容** - 适用于 AWS S3、MinIO、CloudFlare R2 等 S3 兼容服务
- **预签名上传** - 通过预签名 POST 实现安全的客户端上传
- **直接上传** - 从流、Buffer 或字符串进行服务端上传
- **文件持久化** - 两阶段上传：临时 → 永久
- **大小限制** - 可按 MIME 类型配置大小限制
- **GraphQL Resolver** - 内置 GraphQL mutation 用于文件上传
