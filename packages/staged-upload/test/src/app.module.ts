import { StorageModule } from "@nest-boot/storage";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StagedUploadModule } from "../../src/index.js";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const StagedUploadDynamicModule = StagedUploadModule.registerAsync({
  useFactory: () => {
    return {
      permanentPath: "/accepted/files",
      temporaryPath: "/temporary/uploads",
      limits: [
        {
          fileSize: 20 * 1024 * 1024,
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
  imports: [ConfigDynamicModule, StorageModule, StagedUploadDynamicModule],
})
export class AppModule {}
