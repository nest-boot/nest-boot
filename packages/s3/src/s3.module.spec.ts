import { S3Client } from "@aws-sdk/client-s3";
import { Test, type TestingModule } from "@nestjs/testing";

import { S3Module } from "./s3.module.js";

describe("S3Module", () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
    vi.unstubAllEnvs();
  });

  it("provides an S3 client with the AWS SDK defaults", async () => {
    const module = await compile(S3Module);

    expect(module.get(S3Client)).toBeInstanceOf(S3Client);
  });

  it("loads S3 client configuration from the supported environment variables", async () => {
    vi.stubEnv("S3_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("S3_ENDPOINT_URL", "http://s3.local:9000");
    vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
    vi.stubEnv("S3_REGION", "us-west-2");
    const module = await compile(S3Module);
    const client = module.get(S3Client);

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

  it("creates an S3 client with synchronous registration options", async () => {
    const module = await compile(
      S3Module.register({
        endpoint: "http://s3.local:9000",
        forcePathStyle: true,
        region: "us-east-1",
      }),
    );
    const client = module.get(S3Client);

    await expect(client.config.region()).resolves.toBe("us-east-1");
    expect(client.config.forcePathStyle).toBe(true);
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "s3.local",
      port: 9000,
      protocol: "http:",
    });
  });

  it("creates an S3 client with asynchronous registration options", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        region: "eu-west-1",
      }),
    );
    const module = await compile(S3Module.registerAsync({ useFactory }));
    const client = module.get(S3Client);

    expect(useFactory).toHaveBeenCalledOnce();
    await expect(client.config.region()).resolves.toBe("eu-west-1");
  });

  it("destroys the S3 client on application shutdown", async () => {
    const module = await compile(S3Module.register({ region: "us-east-1" }));
    const destroy = vi.spyOn(module.get(S3Client), "destroy");

    await module.close();
    modules.splice(modules.indexOf(module), 1);

    expect(destroy).toHaveBeenCalledOnce();
  });

  async function compile(
    s3Module: typeof S3Module | ReturnType<typeof S3Module.register>,
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [s3Module],
    }).compile();
    modules.push(module);
    return module;
  }
});
