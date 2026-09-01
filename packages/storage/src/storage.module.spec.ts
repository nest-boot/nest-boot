import { S3Module } from "@nest-boot/s3";
import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { Storage } from "./storage.js";
import { StorageModule } from "./storage.module.js";

@Injectable()
class StorageConsumer {
  constructor(readonly storage: Storage) {}
}

@Module({ providers: [StorageConsumer] })
class FeatureModule {}

describe("StorageModule", () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
    vi.unstubAllEnvs();
  });

  it("loads the bucket from S3_BUCKET when imported directly", async () => {
    vi.stubEnv("S3_BUCKET", "environment-bucket");
    const module = await compile(StorageModule);

    expect(module.get(Storage)).toBeInstanceOf(Storage);
  });

  it("supports synchronous registration and exports Storage globally", async () => {
    const module = await compile(
      StorageModule.register({
        bucket: "registered-bucket",
        root: "tenant",
      }),
      FeatureModule,
    );
    const storage = module.get(Storage);

    expect(module.get(StorageConsumer).storage).toBe(storage);
  });

  it("supports asynchronous registration", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        bucket: "async-bucket",
      }),
    );
    const module = await compile(StorageModule.registerAsync({ useFactory }));

    expect(useFactory).toHaveBeenCalledOnce();
    expect(module.get(Storage)).toBeInstanceOf(Storage);
  });

  it("fails fast when neither options nor S3_BUCKET define a bucket", async () => {
    vi.stubEnv("S3_BUCKET", "");

    await expect(compile(StorageModule)).rejects.toThrow(
      "Storage bucket is required",
    );
  });

  async function compile(
    storageModule:
      | typeof StorageModule
      | ReturnType<typeof StorageModule.register>,
    featureModule?: typeof FeatureModule,
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [
        S3Module.register({ region: "us-east-1" }),
        storageModule,
        ...(featureModule ? [featureModule] : []),
      ],
    }).compile();
    modules.push(module);
    return module;
  }
});
