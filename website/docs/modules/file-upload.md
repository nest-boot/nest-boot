---
sidebar_position: 2
---

# 文件上传

Nest Boot 提供开箱即用的上传模块，支持 Minio、AWS S3、阿里云 OSS 对象存储服务

## 安装依赖

```shell
npm i @nest-boot/file-upload minio
```

## 注册模块

```typescript
// ./app.module.ts
import { LoggerModule } from "@nest-boot/file-upload";

const FileUploadDynamicModule = FileUploadModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const bucket = configService.get("S3_BUCKET");

    if (bucket === undefined) {
      throw new Error("S3 BUCKET is not defined");
    }

    return {
      bucket,
      endPoint: configService.getOrThrow("S3_ENDPOINT"),
      ...(configService.get("S3_PORT")
        ? { port: +configService.get("S3_PORT") }
        : {}),
      ...(configService.get("S3_USE_SSL")
        ? { useSSL: configService.get("S3_USE_SSL") === "true" }
        : {}),
      accessKey: configService.getOrThrow("S3_ACCESS_KEY_ID"),
      secretKey: configService.getOrThrow("S3_SECRET_KEY"),
      pathStyle: configService.get("S3_PATH_STYLE") === "true",
      limits: [
        {
          fileSize: bytes("20mb"),
          mimeTypes: [
            "text/csv",
            "image/jpeg",
            "image/png",
            "video/*",
            "video/x-m4v",
            "video/webm",
            "video/x-ms-wmv",
            "video/x-msvideo",
            "video/3gpp",
            "video/flv",
            "video/x-flv",
            "video/mp4",
            "video/quicktime",
            "video/mpeg",
            "video/ogv",
          ],
        },
      ],
    };
  },
});

@Module({
  imports: [FileUploadDynamicModule],
})
export class AppModule {}
```

## 获取临时文件的上传配置：

调用模块提供的 GraphQL 接口 FileUploadResolver
示例：

```GraphQL
mutation {
    CreateFileUploads(input:{
          name: "test.jpeg",
          fileSize: 1024,
          mimeType: "image/jpeg",
    }) {
         url
         fields {
          name
          value
         }
    }
}
```

使用上传配置参数成功上传文件后得到临时文件链接 fileTmpUrl

## 使用模块提供的 tmpAssetToFileAsset() 方法将临时文件转为永久文件

示例：

```typescript
import { tmpAssetToFileAsset } from "@nest-boot/file-upload";

// 模拟创建产品信息
const fileUrl = await tmpAssetToFileAsset(fileTmpUrl);
const product = await orm.create({
  name: "iphone",
  price: "8000.00"
  image: fileUrl,
})
```
