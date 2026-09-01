import { S3Client } from "@aws-sdk/client-s3";
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

  it("loads storage and client configuration from the environment", async () => {
    vi.stubEnv("STORAGE_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("STORAGE_ENDPOINT_URL", "https://environment-bucket.s3.local");
    vi.stubEnv("STORAGE_INTERNAL_ENDPOINT_URL", "http://s3.internal:9000");
    vi.stubEnv("STORAGE_BUCKET_ENDPOINT", "true");
    vi.stubEnv("STORAGE_INTERNAL_BUCKET_ENDPOINT", "false");
    vi.stubEnv("STORAGE_FORCE_PATH_STYLE", "true");
    vi.stubEnv("STORAGE_REGION", "us-west-2");
    vi.stubEnv("STORAGE_BUCKET", "environment-bucket");
    vi.stubEnv("STORAGE_ROOT_PATH", "environment-root");
    const module = await compile(StorageModule);
    const storage = module.get(Storage);
    const { client, internalClient } = storageClients(storage);

    await expect(client.config.region()).resolves.toBe("us-west-2");
    expect(client.config.bucketEndpoint).toBe(true);
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "environment-bucket.s3.local",
      protocol: "https:",
    });
    await expect(internalClient.config.endpoint?.()).resolves.toMatchObject({
      hostname: "s3.internal",
      port: 9000,
      protocol: "http:",
    });
    expect(internalClient.config.bucketEndpoint).toBe(false);
    expect(internalClient.config.forcePathStyle).toBe(true);
    await expect(internalClient.config.credentials()).resolves.toMatchObject({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
    });
    await expect(storage.getUrl("file.txt")).resolves.toBe(
      "https://environment-bucket.s3.local/environment-root/file.txt",
    );
    expect(() => module.get(S3Client)).toThrow();
  });

  it("supports synchronous registration and globally exports Storage only", async () => {
    const module = await compile(
      StorageModule.register({
        accessKeyId: "registered-access-key",
        bucket: "registered-bucket",
        bucketEndpoint: true,
        endpointUrl: "https://registered-bucket.s3.public.example.com",
        forcePathStyle: true,
        internalBucketEndpoint: true,
        internalEndpointUrl:
          "http://registered-bucket.s3.internal.example.com:9000",
        region: "us-east-1",
        rootPath: "tenant",
        secretAccessKey: "registered-secret-key",
      }),
      FeatureModule,
    );
    const storage = module.get(Storage);
    const consumer = module.get(StorageConsumer);
    const { client, internalClient } = storageClients(storage);

    expect(consumer.storage).toBe(storage);
    expect(client).not.toBe(internalClient);
    expect(client.config.bucketEndpoint).toBe(true);
    expect(internalClient.config.bucketEndpoint).toBe(true);
    expect(client.config.forcePathStyle).toBe(false);
    expect(internalClient.config.forcePathStyle).toBe(false);
    await expect(storage.getUrl("file.txt")).resolves.toBe(
      "https://registered-bucket.s3.public.example.com/tenant/file.txt",
    );
    expect(() => module.get(S3Client)).toThrow();
  });

  it("supports asynchronous registration", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        bucket: "async-bucket",
        region: "eu-west-1",
      }),
    );
    const module = await compile(StorageModule.registerAsync({ useFactory }));
    const storage = module.get(Storage);

    expect(useFactory).toHaveBeenCalledOnce();
    await expect(storageClients(storage).client.config.region()).resolves.toBe(
      "eu-west-1",
    );
  });

  it("reuses one client when the internal configuration is identical", async () => {
    const module = await compile(
      StorageModule.register({
        bucket: "registered-bucket",
        bucketEndpoint: true,
        endpointUrl: "https://registered-bucket.s3.public.example.com",
        region: "us-east-1",
      }),
    );
    const storage = module.get(Storage);
    const { client, internalClient } = storageClients(storage);
    const destroy = vi.spyOn(client, "destroy");

    expect(internalClient).toBe(client);
    expect(internalClient.config.bucketEndpoint).toBe(true);

    await module.close();
    modules.splice(modules.indexOf(module), 1);

    expect(destroy).toHaveBeenCalledOnce();
  });

  it("destroys both clients on application shutdown", async () => {
    const module = await compile(
      StorageModule.register({
        bucket: "registered-bucket",
        endpointUrl: "https://s3.public.example.com",
        internalEndpointUrl: "http://s3.internal:9000",
        region: "us-east-1",
      }),
    );
    const storage = module.get(Storage);
    const { client, internalClient } = storageClients(storage);
    const destroyClient = vi.spyOn(client, "destroy");
    const destroyInternalClient = vi.spyOn(internalClient, "destroy");

    await module.close();
    modules.splice(modules.indexOf(module), 1);

    expect(destroyClient).toHaveBeenCalledOnce();
    expect(destroyInternalClient).toHaveBeenCalledOnce();
  });

  it("fails fast when neither options nor STORAGE_BUCKET define a bucket", async () => {
    vi.stubEnv("STORAGE_BUCKET", "");

    await expect(compile(StorageModule)).rejects.toThrow(
      "Storage bucket is required",
    );
  });

  it("requires both flattened credential values", async () => {
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "");

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

function storageClients(storage: Storage): {
  client: S3Client;
  internalClient: S3Client;
} {
  return storage as unknown as {
    client: S3Client;
    internalClient: S3Client;
  };
}
