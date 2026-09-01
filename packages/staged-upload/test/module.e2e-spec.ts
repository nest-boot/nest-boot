import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Test, type TestingModule } from "@nestjs/testing";

import { type StagedUploadService } from "../src/staged-upload.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const requiredS3Env = [
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_BUCKET",
  "STORAGE_ENDPOINT_URL",
  "STORAGE_SECRET_ACCESS_KEY",
];
const describeIfS3Configured = requiredS3Env.every((name) => process.env[name])
  ? describe
  : describe.skip;

function getS3Bucket() {
  const bucket = process.env.STORAGE_BUCKET;

  if (!bucket) {
    throw new Error(
      "S3 environment variables are required for this test suite",
    );
  }

  return bucket;
}

async function ensureBucketExists(client: S3Client, bucket: string) {
  try {
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
      }),
    );
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

function getSetupBucket(): string {
  return process.env.STORAGE_BUCKET_ENDPOINT?.toLowerCase() === "true"
    ? requiredStorageEnv("STORAGE_ENDPOINT_URL")
    : getS3Bucket();
}

function requiredStorageEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for this test suite`);
  }
  return value;
}

describeIfS3Configured("StagedUploadModule - e2e", () => {
  let moduleRef: TestingModule;
  let stagedUploadService: StagedUploadService;

  const filename = "test.jpeg";
  const fileSize = 48445;
  const fileSizeLimited = 100 * 1024 * 1024;
  const mimeType = "image/jpeg";
  const filePath = "./attachments/test.jpeg";

  let stagedUploadArgs: {
    url: string;
    fields: Record<string, string>[];
  };

  // Temporary file URL
  let fileTmpUrl: string;

  beforeAll(async () => {
    const [{ AppModule }, { StagedUploadService }] = await Promise.all([
      import("./src/app.module.js"),
      import("../src/staged-upload.service.js"),
    ]);
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const setupClient = createSetupClient();
    await ensureBucketExists(setupClient, getSetupBucket());
    setupClient.destroy();

    stagedUploadService = moduleRef.get(StagedUploadService);
    await moduleRef.init();
  }, 60000);

  afterAll(async () => {
    await moduleRef.close();
  }, 60000);

  it("should successfully get the upload parameter configuration", async () => {
    const [created] = await stagedUploadService.create([
      { name: filename, fileSize, mimeType },
    ]);

    expect(created).toBeTruthy();
    stagedUploadArgs = created;
  }, 10000);

  it("should successfully uploads temporary file", async () => {
    expect(stagedUploadArgs).toBeTruthy();

    const form = new FormData();

    // Add file and other fields to the form
    stagedUploadArgs.fields.forEach((field) => {
      form.append(field.name, field.value);
    });

    const file = await readFile(resolve(__dirname, filePath));
    form.append("file", new Blob([file], { type: mimeType }), filename);

    // Upload temporary file
    const response = await fetch(stagedUploadArgs.url, {
      body: form,
      method: "POST",
    });

    expect(response.status).toBe(201);

    const responseBody = await response.text();
    const location = /<Location>(.*?)<\/Location>/.exec(responseBody)?.[1];
    if (!location) {
      throw new Error("S3 upload response did not contain a Location");
    }
    fileTmpUrl = location;

    expect(fileTmpUrl).toBeTruthy();
    expect(fileTmpUrl).toContain("/temporary/uploads/");
  }, 10000);

  it("should successfully persists the temporary file", async () => {
    expect(fileTmpUrl).toBeTruthy();

    const fileUrl = await stagedUploadService.persist(fileTmpUrl);

    expect(fileUrl).toBeTruthy();
    expect(fileUrl).toContain("/accepted/files/");
  }, 10000);

  it("should successfully upload temporary file", async () => {
    const buffer = await readFile(resolve(__dirname, filePath));

    const tmpFileUrl = await stagedUploadService.upload(buffer, {
      "Content-Type": mimeType,
    });

    expect(tmpFileUrl).toBeTruthy();
    expect(tmpFileUrl).toContain("/temporary/uploads/");
  }, 10000);

  it("should successfully upload persistent file", async () => {
    const buffer = await readFile(resolve(__dirname, filePath));

    const fileUrl = await stagedUploadService.upload(
      buffer,
      {
        "Content-Type": mimeType,
        extension: "my file",
      },
      true,
    );

    expect(fileUrl).toBeTruthy();
    expect(fileUrl).toContain("/accepted/files/");
    expect(fileUrl).toContain(".my%20file");
  }, 10000);

  it("file is too large, should throw an exception", async () => {
    await expect(
      stagedUploadService.create([
        { name: filename, fileSize: fileSizeLimited, mimeType },
      ]),
    ).rejects.toThrow();
  }, 10000);
});
