import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Readable } from "node:stream";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { type INestApplication, Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { StorageModule, StorageService } from "../../src/index.js";

const requiredS3Env = [
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_BUCKET",
  "STORAGE_ENDPOINT_URL",
  "STORAGE_SECRET_ACCESS_KEY",
];
const describeIfS3Configured = requiredS3Env.every((name) => process.env[name])
  ? describe
  : describe.skip;
const testRoot = `storage-e2e/${randomUUID()}`;
const testBucket = process.env.STORAGE_BUCKET ?? "test-bucket";

/**
 * Returns bucket configured for storage integration tests.
 * @returns Bucket configured for storage integration tests.
 */
function getS3Bucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      "S3 environment variables are required for this test suite",
    );
  }
  return bucket;
}

@Injectable()
class StorageConsumer {
  constructor(readonly storage: StorageService) {}
}

@Module({ providers: [StorageConsumer] })
class FeatureModule {}

@Module({
  imports: [
    StorageModule.forRoot({
      bucket: testBucket,
      rootPath: testRoot,
      ssrf: {
        allowedHosts: ["127.0.0.1"],
      },
      upload: {
        limits: [{ fileSize: 1024 * 1024, mimeTypes: ["text/*", "image/*"] }],
      },
    }),
    FeatureModule,
  ],
})
class AppModule {}

describeIfS3Configured("StorageModule - e2e", () => {
  let app: INestApplication;
  let storage: StorageService;
  const createdKeys: string[] = [];

  beforeAll(async () => {
    const setupClient = createSetupClient();
    await ensureBucketExists(setupClient, getSetupBucket());
    setupClient.destroy();

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    storage = app.get(StorageService);
  }, 60_000);

  afterAll(async () => {
    if (createdKeys.length > 0) {
      await storage.deleteFile(createdKeys);
    }
    await app.close();
  }, 60_000);

  it("provides the same global StorageService to feature modules", () => {
    const consumer = app.get(StorageConsumer);

    expect(consumer.storage).toBe(storage);
    expect(() => app.get(S3Client)).toThrow();
  });

  it("uploads into fixed tmp/ and files/YYYY/MM/DD/ paths, stats, streams, and deletes", async () => {
    const tempKey = await storage.uploadTemporaryFile("temporary note", {
      contentType: "text/plain",
    });
    const permanentKey = await storage.uploadFile(
      Readable.from(["permanent report"]),
      { contentType: "text/plain" },
    );

    expect(tempKey).toMatch(/^tmp\/[^/]+\.txt$/);
    expect(permanentKey).toMatch(/^files\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.txt$/);

    await expect(storage.statFile(permanentKey)).resolves.toMatchObject({
      size: 16,
      contentType: "text/plain",
    });
    await expect(storage.statFile("files/missing.txt")).resolves.toBeNull();

    await expect(storage.readFile(permanentKey, "utf8")).resolves.toBe(
      "permanent report",
    );
    await expect(storage.readFile(tempKey)).resolves.toEqual(
      Buffer.from("temporary note"),
    );

    const chunks: Buffer[] = [];
    for await (const chunk of storage.createReadStream(permanentKey, {
      start: 0,
      end: 8,
    })) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe("permanent");

    await storage.deleteFile([tempKey, permanentKey]);
    await expect(storage.statFile(permanentKey)).resolves.toBeNull();
  }, 30_000);

  it("stages client presigned POST uploads, previews resourceUrl, and promotes via uploadFileFromUrl", async () => {
    const upload = await storage.createTemporaryFileUploadUrl({
      name: "note.txt",
      fileSize: 12,
      mimeType: "text/plain",
    });

    const form = new FormData();
    for (const field of upload.fields) {
      form.append(field.name, field.value);
    }
    form.append("file", new Blob(["hello staged"], { type: "text/plain" }));

    const uploadResponse = await fetch(upload.url, {
      method: "POST",
      body: form,
    });
    expect(uploadResponse.status).toBe(201);

    await expect(storage.isTemporaryFileUrl(upload.resourceUrl)).resolves.toBe(
      true,
    );
    await expect(
      storage.isTemporaryFileUrl("https://example.test/tmp/external.txt"),
    ).resolves.toBe(false);

    const previewResponse = await fetch(upload.resourceUrl);
    expect(previewResponse.ok).toBe(true);
    expect(previewResponse.headers.get("content-disposition")).toBe(
      "attachment",
    );
    await expect(previewResponse.text()).resolves.toBe("hello staged");

    const permanentKey = await storage.uploadFileFromUrl(upload.resourceUrl);
    const secondPermanentKey = await storage.uploadFileFromUrl(
      upload.resourceUrl,
    );
    const stagedFieldKey =
      upload.fields.find((field) => field.name === "key")?.value ?? "";
    const relativeTmpKey = stagedFieldKey.slice(testRoot.length + 1);
    createdKeys.push(relativeTmpKey, permanentKey, secondPermanentKey);

    expect(permanentKey).toMatch(/^files\/\d{4}\/\d{2}\/\d{2}\/.+\.txt$/);
    expect(secondPermanentKey).not.toBe(permanentKey);
    await expect(storage.statFile(relativeTmpKey)).resolves.toMatchObject({
      size: 12,
    });
    const permanentStat = await storage.statFile(permanentKey);
    expect(permanentStat).toMatchObject({
      size: 12,
      contentType: "text/plain",
    });
    expect(permanentStat?.metadata).toBeUndefined();
    await expect(storage.readFile(permanentKey, "utf8")).resolves.toBe(
      "hello staged",
    );

    // Unsigned tmp URL or tampered signature cannot promote staged objects with server credentials
    const unsignedTmpUrl = upload.resourceUrl.split("?", 1)[0] ?? "";
    await expect(storage.isTemporaryFileUrl(unsignedTmpUrl)).rejects.toThrow(
      "Invalid or expired temporary file URL",
    );
    await expect(storage.uploadFileFromUrl(unsignedTmpUrl)).rejects.toThrow(
      "Invalid or expired temporary file URL",
    );
  }, 30_000);

  it("streams external URLs directly into S3 without RequestContext while honoring ssrf.allowedHosts", async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end("remote-png-data");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }

      const key = await storage.uploadFileFromUrl(
        `http://127.0.0.1:${String(address.port)}/avatar.png`,
        { allowedMimeTypes: ["image/*"] },
      );
      createdKeys.push(key);
      expect(key).toMatch(/^files\/\d{4}\/\d{2}\/\d{2}\/.+\.png$/);
      await expect(storage.readFile(key, "utf8")).resolves.toBe(
        "remote-png-data",
      );

      await expect(
        storage.uploadFileFromUrl("http://169.254.169.254/latest/meta-data/"),
      ).rejects.toThrow("disallowed network address");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  }, 30_000);
});

/**
 * Creates the test bucket when it is not already available.
 * @param client - Client used to communicate with the backing service.
 * @param bucket - S3 bucket used for the operation.
 */
async function ensureBucketExists(
  client: S3Client,
  bucket: string,
): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (
      errorName !== "BucketAlreadyExists" &&
      errorName !== "BucketAlreadyOwnedByYou"
    ) {
      throw error;
    }
  }
}

/**
 * Returns S3 client used to prepare integration test resources.
 * @returns S3 client used to prepare integration test resources.
 */
function createSetupClient(): S3Client {
  const bucketEndpoint =
    process.env.STORAGE_BUCKET_ENDPOINT?.toLowerCase() === "true";

  return new S3Client({
    ...(bucketEndpoint ? { bucketEndpoint: true } : {}),
    credentials: {
      accessKeyId: requiredStorageEnv("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requiredStorageEnv("STORAGE_SECRET_ACCESS_KEY"),
    },
    endpoint: process.env.STORAGE_ENDPOINT_URL,
    ...(bucketEndpoint
      ? {}
      : {
          forcePathStyle:
            process.env.STORAGE_FORCE_PATH_STYLE?.toLowerCase() === "true",
        }),
    region: process.env.STORAGE_REGION ?? "us-east-1",
  });
}

/**
 * Returns bucket name or bucket endpoint used by setup operations.
 * @returns Bucket name or bucket endpoint used by setup operations.
 */
function getSetupBucket(): string {
  return process.env.STORAGE_BUCKET_ENDPOINT?.toLowerCase() === "true"
    ? requiredStorageEnv("STORAGE_ENDPOINT_URL")
    : getS3Bucket();
}

/**
 * Returns non-empty value of the required storage setting.
 * @param name - Name used to identify the resource.
 * @returns Non-empty value of the required storage setting.
 */
function requiredStorageEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for this test suite`);
  }
  return value;
}
