import { GraphQLModule } from "@nest-boot/graphql";
import { S3Module } from "@nest-boot/s3";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import bytes from "bytes";

import { FileUploadModule } from "../../src/index.js";
import { TestResolver } from "./test.resolver.js";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const FileUploadDynamicModule = FileUploadModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return {
      bucket: configService.getOrThrow("S3_BUCKET"),
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
  imports: [
    ConfigDynamicModule,
    S3Module,
    GraphQLModule,
    FileUploadDynamicModule,
  ],
  providers: [TestResolver],
})
export class AppModule {}
