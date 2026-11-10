import { StorageModule } from "@nest-boot/storage";
import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { StagedUploadModule } from "../dist/staged-upload.module.js";
import { StagedUploadService } from "../dist/staged-upload.service.js";

@Injectable()
class StagedUploadConsumer {
  constructor(readonly stagedUploadService: StagedUploadService) {}
}

@Module({ providers: [StagedUploadConsumer] })
class FeatureModule {}

describe("StagedUploadModule", () => {
  const options = {};
  it("should globally export StagedUploadService", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        StorageModule.register({ bucket: "test-bucket" }),
        StagedUploadModule.register(options),
        FeatureModule,
      ],
    }).compile();
    expect(moduleRef.get(StagedUploadConsumer).stagedUploadService).toBe(
      moduleRef.get(StagedUploadService),
    );
    await moduleRef.close();
  });
});
