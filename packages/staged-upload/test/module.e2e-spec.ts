import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import axios from "axios";
import bytes from "bytes";
import FormData from "form-data";
import request from "supertest";

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

function parseFileSize(value: string) {
  const parsed = bytes(value);

  if (typeof parsed !== "number") {
    throw new Error(`Unable to parse file size: ${value}`);
  }

  return parsed;
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
  let app: INestApplication;
  let stagedUploadService: StagedUploadService;

  const filename = "test.jpeg";
  const fileSize = 48445;
  const fileSizeLimited = parseFileSize("100mb");
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
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const setupClient = createSetupClient();
    await ensureBucketExists(setupClient, getSetupBucket());
    setupClient.destroy();

    app = module.createNestApplication();
    stagedUploadService = module.get(StagedUploadService);

    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 60000);

  it("should successfully gets the upload parameter configuration", async () => {
    const createStagedUploads = await request(app.getHttpServer())
      .post("/api/graphql")
      .send({
        query: /* GraphQL */ `
          mutation CreateStagedUploads($input: [StagedUploadInput!]!) {
            createStagedUploads(input: $input) {
              url
              fields {
                name
                value
              }
            }
          }
        `,
        variables: {
          input: [
            {
              name: filename,
              fileSize,
              mimeType,
            },
          ],
        },
      });

    expect(createStagedUploads.status).toBe(200);
    expect(createStagedUploads.body.data.createStagedUploads[0]).toBeTruthy();

    stagedUploadArgs = createStagedUploads.body.data.createStagedUploads[0];
  }, 10000);

  it("should successfully uploads temporary file", async () => {
    expect(stagedUploadArgs).toBeTruthy();

    const form = new FormData();

    // Add file and other fields to the form
    stagedUploadArgs.fields.forEach((field) => {
      form.append(field.name, field.value);
    });

    const fileStream = fs.createReadStream(resolve(__dirname, filePath));
    form.append("file", fileStream);

    // Upload temporary file
    const response = await axios.post(stagedUploadArgs.url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    expect(response.status).toBe(201);

    fileTmpUrl = response.data.match(/<Location>(.*?)<\/Location>/)[1];

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
    const buffer = fs.readFileSync(resolve(__dirname, filePath));

    const tmpFileUrl = await stagedUploadService.upload(buffer, {
      "Content-Type": mimeType,
    });

    expect(tmpFileUrl).toBeTruthy();
    expect(tmpFileUrl).toContain("/temporary/uploads/");
  }, 10000);

  it("should successfully upload persistent file", async () => {
    const buffer = fs.readFileSync(resolve(__dirname, filePath));

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
