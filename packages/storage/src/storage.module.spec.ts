import { S3Client } from "@aws-sdk/client-s3";
import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { Storage } from "./storage.js";
import { StorageModule } from "./storage.module.js";

@Injectable()
class StorageConsumer {
  constructor(
    readonly storage: Storage,
    readonly s3Client: S3Client,
  ) {}
}

@Module({ providers: [StorageConsumer] })
class FeatureModule {}

describe("StorageModule", () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
    vi.unstubAllEnvs();
  });

  it("loads storage and S3 client configuration from the environment", async () => {
    vi.stubEnv("S3_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("S3_ENDPOINT_URL", "http://s3.local:9000");
    vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
    vi.stubEnv("S3_REGION", "us-west-2");
    vi.stubEnv("S3_BUCKET", "environment-bucket");
    const module = await compile(StorageModule);
    const client = module.get(S3Client);

    expect(module.get(Storage)).toBeInstanceOf(Storage);
    await expect(client.config.region()).resolves.toBe("us-west-2");
    expect(client.config.forcePathStyle).toBe(true);
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "s3.local",
      port: 9000,
      protocol: "http:",
    });
    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
    });
  });

  it("supports synchronous registration and globally exports both providers", async () => {
    const module = await compile(
      StorageModule.register({
        bucket: "registered-bucket",
        client: {
          endpoint: "http://s3.local:9000",
          forcePathStyle: true,
          region: "us-east-1",
        },
        root: "tenant",
      }),
      FeatureModule,
    );
    const client = module.get(S3Client);
    const storage = module.get(Storage);
    const consumer = module.get(StorageConsumer);

    expect(consumer.storage).toBe(storage);
    expect(consumer.s3Client).toBe(client);
    await expect(client.config.region()).resolves.toBe("us-east-1");
    expect(client.config.forcePathStyle).toBe(true);
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "s3.local",
      port: 9000,
      protocol: "http:",
    });
  });

  it("supports asynchronous registration", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        bucket: "async-bucket",
        client: { region: "eu-west-1" },
      }),
    );
    const module = await compile(StorageModule.registerAsync({ useFactory }));

    expect(useFactory).toHaveBeenCalledOnce();
    expect(module.get(Storage)).toBeInstanceOf(Storage);
    await expect(module.get(S3Client).config.region()).resolves.toBe(
      "eu-west-1",
    );
  });

  it("destroys the S3 client on application shutdown", async () => {
    const module = await compile(
      StorageModule.register({
        bucket: "registered-bucket",
        client: { region: "us-east-1" },
      }),
    );
    const destroy = vi.spyOn(module.get(S3Client), "destroy");

    await module.close();
    modules.splice(modules.indexOf(module), 1);

    expect(destroy).toHaveBeenCalledOnce();
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
      imports: [storageModule, ...(featureModule ? [featureModule] : [])],
    }).compile();
    modules.push(module);
    return module;
  }
});
