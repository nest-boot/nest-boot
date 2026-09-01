import { GraphQLModule } from "@nest-boot/graphql";
import { StorageModule } from "@nest-boot/storage";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import bytes from "bytes";

import { FileUploadModule } from "../../src/index.js";
import { TestResolver } from "./test.resolver.js";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const FileUploadDynamicModule = FileUploadModule.registerAsync({
  useFactory: () => {
    return {
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
    StorageModule,
    GraphQLModule,
    FileUploadDynamicModule,
  ],
  providers: [TestResolver],
})
export class AppModule {}
