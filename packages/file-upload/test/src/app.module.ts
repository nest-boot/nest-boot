import { GraphQLModule } from "@nest-boot/graphql";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import bytes from "bytes";

import { FileUploadModule } from "../../src";
import { TestResolver } from "./test.resolver";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const FileUploadDynamicModule = FileUploadModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return {
      bucket: configService.getOrThrow("S3_BUCKET"),
      client: {
        endpoint: configService.getOrThrow("S3_ENDPOINT"),
        region: configService.get("S3_REGION"),
        forcePathStyle: configService.get("S3_FORCE_PATH_STYLE") === "true",
        credentials: {
          accessKeyId: configService.getOrThrow("S3_ACCESS_KEY_ID"),
          secretAccessKey: configService.getOrThrow("S3_SECRET_ACCESS_KEY"),
        },
      },
      limits: [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          fileSize: bytes("20mb")!,
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
  imports: [ConfigDynamicModule, GraphQLModule, FileUploadDynamicModule],
  providers: [TestResolver],
})
export class AppModule {}
