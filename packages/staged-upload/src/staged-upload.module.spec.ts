import { StorageModule } from "@nest-boot/storage";
import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { StagedUploadModule } from "./staged-upload.module.js";
import { MODULE_OPTIONS_TOKEN } from "./staged-upload.module-definition.js";
import { StagedUploadService } from "./staged-upload.service.js";

@Injectable()
class StagedUploadConsumer {
  constructor(readonly stagedUploadService: StagedUploadService) {}
}

@Module({ providers: [StagedUploadConsumer] })
class FeatureModule {}

describe("StagedUploadModule", () => {
  const options = {};

  it("should register synchronous options", () => {
    const dynamicModule = StagedUploadModule.register(options);

    expect(dynamicModule.module).toBe(StagedUploadModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
  });

  it("should register asynchronous options", () => {
    const useFactory = () => options;
    const dynamicModule = StagedUploadModule.registerAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(StagedUploadModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

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
