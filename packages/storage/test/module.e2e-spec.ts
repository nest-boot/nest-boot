import { randomUUID } from "node:crypto";
import { finished } from "node:stream/promises";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { type INestApplication, Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Storage, StorageModule } from "../src/index.js";

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
  constructor(
    readonly storage: Storage,
    readonly s3Client: S3Client,
  ) {}
}

@Module({ providers: [StorageConsumer] })
class FeatureModule {}

@Module({
  imports: [
    StorageModule.register({ bucket: testBucket, rootPath: testRoot }),
    FeatureModule,
  ],
})
class AppModule {}

describeIfS3Configured("StorageModule - e2e", () => {
  let app: INestApplication;
  let storage: Storage;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await ensureBucketExists(module.get(S3Client), getS3Bucket());

    app = module.createNestApplication();
    await app.init();
    storage = app.get(Storage);
  }, 60_000);

  afterAll(async () => {
    const entries = await storage.listEntries("", { recursive: true });
    await storage.deleteFile(
      entries
        .filter((entry) => entry.type === "file")
        .map((entry) => entry.path),
    );
    await app.close();
  }, 60_000);

  it("provides the same global Storage and S3Client to feature modules", () => {
    const consumer = app.get(StorageConsumer);

    expect(consumer.storage).toBe(storage);
    expect(consumer.s3Client).toBe(app.get(S3Client));
  });

  it("stores, lists, copies, moves, and deletes files", async () => {
    await Promise.all([
      storage.writeFile("root.txt", "root", { ContentType: "text/plain" }),
      storage.writeFile("docs/read me.txt", "read me", {
        ContentType: "text/plain",
      }),
      storage.writeFile("docs/guides/start.txt", "start", {
        ContentType: "text/plain",
      }),
    ]);

    expect(entryKinds(await storage.listEntries())).toEqual([
      { path: "docs", type: "directory" },
      { path: "root.txt", type: "file" },
    ]);
    expect(entryKinds(await storage.listEntries("docs"))).toEqual([
      { path: "docs/guides", type: "directory" },
      { path: "docs/read me.txt", type: "file" },
    ]);
    expect(
      entryKinds(await storage.listEntries("", { recursive: true })),
    ).toEqual([
      { path: "docs", type: "directory" },
      { path: "docs/guides", type: "directory" },
      { path: "docs/guides/start.txt", type: "file" },
      { path: "docs/read me.txt", type: "file" },
      { path: "root.txt", type: "file" },
    ]);

    await storage.copyFile("docs/read me.txt", "copies/read me.txt");
    await storage.moveFile("copies/read me.txt", "moved/read me.txt");
    await storage.deleteFile(["root.txt", "moved/read me.txt"]);

    const entries = await storage.listEntries("", { recursive: true });
    expect(
      entries.filter((entry) => entry.type === "file").map(({ path }) => path),
    ).toEqual(["docs/guides/start.txt", "docs/read me.txt"]);
  }, 30_000);

  it("reads files and supports readable and writable streams", async () => {
    await expect(storage.readFile("docs/read me.txt", "utf8")).resolves.toBe(
      "read me",
    );
    await expect(storage.readFile("docs/read me.txt")).resolves.toEqual(
      Buffer.from("read me"),
    );

    const chunks: Buffer[] = [];
    for await (const chunk of storage.createReadStream("docs/read me.txt", {
      start: 0,
      end: 3,
    })) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe("read");

    const writable = storage.createWriteStream("streams/output.txt", {
      ContentType: "text/plain",
    });
    writable.end("stream upload");
    await finished(writable);
    await expect(storage.readFile("streams/output.txt", "utf8")).resolves.toBe(
      "stream upload",
    );
  }, 30_000);

  it("creates direct and temporary object URLs", async () => {
    await expect(storage.getUrl("docs/read me.txt")).resolves.toContain(
      `${testBucket}/${testRoot}/docs/read%20me.txt`,
    );

    const temporaryUrl = await storage.createTemporaryUrl("docs/read me.txt", {
      expiresIn: 60,
    });
    const response = await fetch(temporaryUrl);

    expect(response.ok).toBe(true);
    await expect(response.text()).resolves.toBe("read me");
  }, 30_000);
});

function entryKinds(
  entries: Awaited<ReturnType<Storage["listEntries"]>>,
): { path: string; type: "file" | "directory" }[] {
  return entries.map(({ path, type }) => ({ path, type }));
}

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
