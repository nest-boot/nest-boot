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
    vi.stubEnv("STORAGE_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("STORAGE_ENDPOINT_URL", "http://s3.local:9000");
    vi.stubEnv("STORAGE_INTERNAL_ENDPOINT_URL", "http://s3.internal:9000");
    vi.stubEnv("STORAGE_FORCE_PATH_STYLE", "true");
    vi.stubEnv("STORAGE_REGION", "us-west-2");
    vi.stubEnv("STORAGE_BUCKET", "environment-bucket");
    vi.stubEnv("STORAGE_ROOT_PATH", "environment-root");
    const module = await compile(StorageModule);
    const client = module.get(S3Client);
    const storage = module.get(Storage);

    expect(storage).toBeInstanceOf(Storage);
    await expect(client.config.region()).resolves.toBe("us-west-2");
    expect(client.config.forcePathStyle).toBe(true);
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "s3.internal",
      port: 9000,
      protocol: "http:",
    });
    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
    });
    await expect(storage.getUrl("file.txt")).resolves.toBe(
      "http://s3.local:9000/environment-bucket/environment-root/file.txt",
    );
  });

  it("supports synchronous registration and globally exports both providers", async () => {
    const module = await compile(
      StorageModule.register({
        accessKeyId: "registered-access-key",
        bucket: "registered-bucket",
        endpointUrl: "https://s3.public.example.com",
        forcePathStyle: true,
        internalEndpointUrl: "http://s3.internal:9000",
        publicEndpointUrl: "https://cdn.example.com/assets",
        region: "us-east-1",
        rootPath: "tenant",
        secretAccessKey: "registered-secret-key",
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
      hostname: "s3.internal",
      port: 9000,
      protocol: "http:",
    });
    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: "registered-access-key",
      secretAccessKey: "registered-secret-key",
    });
    await expect(storage.getUrl("file.txt")).resolves.toBe(
      "https://cdn.example.com/assets/tenant/file.txt",
    );
  });

  it("supports asynchronous registration", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        bucket: "async-bucket",
        region: "eu-west-1",
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
        region: "us-east-1",
      }),
    );
    const destroy = vi.spyOn(module.get(S3Client), "destroy");

    await module.close();
    modules.splice(modules.indexOf(module), 1);

    expect(destroy).toHaveBeenCalledOnce();
  });

  it("fails fast when neither options nor STORAGE_BUCKET define a bucket", async () => {
    vi.stubEnv("STORAGE_BUCKET", "");

    await expect(compile(StorageModule)).rejects.toThrow(
      "Storage bucket is required",
    );
  });

  it("requires both flattened credential values", async () => {
    await expect(
      compile(
        StorageModule.register({
          accessKeyId: "access-key",
          bucket: "registered-bucket",
        }),
      ),
    ).rejects.toThrow(
      "Storage credentials require both accessKeyId and secretAccessKey",
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
