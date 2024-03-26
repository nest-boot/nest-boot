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

响应

```json
{
  "data": {
    "createFileUploads": [
      {
        "url": "http://localhost:9000/test",
        "fields": [
          {
            "name": "key",
            "value": "tmp/65227ee1-891f-4d46-a629-29da5e38c575.jpeg"
          },
          {
            "name": "acl",
            "value": "private"
          },
          {
            "name": "bucket",
            "value": "test"
          },
          {
            "name": "success_action_status",
            "value": "201"
          },
          {
            "name": "Content-Type",
            "value": "image/jpeg"
          },
          {
            "name": "x-amz-date",
            "value": "20240326T061613Z"
          },
          {
            "name": "x-amz-algorithm",
            "value": "AWS4-HMAC-SHA256"
          },
          {
            "name": "x-amz-credential",
            "value": "minio/20240326/us-east-1/s3/aws4_request"
          },
          {
            "name": "policy",
            "value": "eyJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwyMDk3MTUyMF0sWyJlcSIsIiRhY2wiLCJwcml2YXRlIl0sWyJlcSIsIiRidWNrZXQiLCJ0ZXN0Il0sWyJlcSIsIiRrZXkiLCJ0bXAvNjUyMjdlZTEtODkxZi00ZDQ2LWE2MjktMjlkYTVlMzhjNTc1LmpwZWciXSxbImVxIiwiJHN1Y2Nlc3NfYWN0aW9uX3N0YXR1cyIsIjIwMSJdLFsiZXEiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvanBlZyJdLFsiZXEiLCIkeC1hbXotZGF0ZSIsIjIwMjQwMzI2VDA2MTYxM1oiXSxbImVxIiwiJHgtYW16LWFsZ29yaXRobSIsIkFXUzQtSE1BQy1TSEEyNTYiXSxbImVxIiwiJHgtYW16LWNyZWRlbnRpYWwiLCJtaW5pby8yMDI0MDMyNi91cy1lYXN0LTEvczMvYXdzNF9yZXF1ZXN0Il1dLCJleHBpcmF0aW9uIjoiMjAyNC0wMy0yNlQwNzoxNjoxMy4xMDNaIn0="
          },
          {
            "name": "x-amz-signature",
            "value": "9c3e7658dc7aab7c4d2de5248acc7310e7f029f13a35cb5aca4fb04703bec4c3"
          }
        ]
      }
    ]
  },
  "extensions": {
    "cost": {
      "requestedQueryCost": 2,
      "actualQueryCost": 2,
      "throttleStatus": {
        "maximumAvailable": 1000,
        "currentlyAvailable": 998,
        "restoreRate": 50
      }
    }
  }
}
```

使用上传配置进行临时文件的上传

文件上传的 curl 请求：

```shell
curl --location 'http://localhost:9000/test' \
--form 'key="tmp/65227ee1-891f-4d46-a629-29da5e38c575.jpeg"' \
--form 'acl="private"' \
--form 'bucket="test"' \
--form 'success_action_status="201"' \
--form 'Content-Type="image/jpeg"' \
--form 'x-amz-date="20240326T061613Z"' \
--form 'x-amz-algorithm="AWS4-HMAC-SHA256"' \
--form 'x-amz-credential="minio/20240326/us-east-1/s3/aws4_request"' \
--form 'policy="eyJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwyMDk3MTUyMF0sWyJlcSIsIiRhY2wiLCJwcml2YXRlIl0sWyJlcSIsIiRidWNrZXQiLCJ0ZXN0Il0sWyJlcSIsIiRrZXkiLCJ0bXAvNjUyMjdlZTEtODkxZi00ZDQ2LWE2MjktMjlkYTVlMzhjNTc1LmpwZWciXSxbImVxIiwiJHN1Y2Nlc3NfYWN0aW9uX3N0YXR1cyIsIjIwMSJdLFsiZXEiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvanBlZyJdLFsiZXEiLCIkeC1hbXotZGF0ZSIsIjIwMjQwMzI2VDA2MTYxM1oiXSxbImVxIiwiJHgtYW16LWFsZ29yaXRobSIsIkFXUzQtSE1BQy1TSEEyNTYiXSxbImVxIiwiJHgtYW16LWNyZWRlbnRpYWwiLCJtaW5pby8yMDI0MDMyNi91cy1lYXN0LTEvczMvYXdzNF9yZXF1ZXN0Il1dLCJleHBpcmF0aW9uIjoiMjAyNC0wMy0yNlQwNzoxNjoxMy4xMDNaIn0="' \
--form 'x-amz-signature="9c3e7658dc7aab7c4d2de5248acc7310e7f029f13a35cb5aca4fb04703bec4c3"' \
--form 'file=@"/Users/mac/Documents/1707209727994.jpg"'
```

成功响应：

```HTMl
<?xml version="1.0" encoding="UTF-8"?>
<PostResponse>
    <Bucket>test</Bucket>
    <Key>tmp/65227ee1-891f-4d46-a629-29da5e38c575.jpeg</Key>
    <ETag>&#34;0c86f163a1132b3f59b556fd5ed003fc&#34;</ETag>
    <Location>http://localhost:9000/test/tmp/65227ee1-891f-4d46-a629-29da5e38c575.jpeg</Location>
</PostResponse>
```

Location 的值就是临时文件 Url

## 使用模块提供的 tmpAssetToFileAsset() 方法将临时文件转为永久文件

示例：

```typescript
import { tmpAssetToFileAsset } from "@nest-boot/file-upload";

// 模拟创建产品
async create(input: CreateProductInput): Promise<Product> {
  // 获取永久图片地址
  const imageUrl = await this.fileUploadService.tmpAssetToFileAsset(
    input.imageTmpUrl,
  );

  const product = new Product();

  product.name = input.name;
  product.description = input.description;
  product.imageUrl = imageUrl;

  this.products.push(product);

  return product;
}
```
