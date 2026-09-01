import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import { Storage } from "./storage.js";

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

const createPresignedPostMock = vi.mocked(createPresignedPost);
const getSignedUrlMock = vi.mocked(getSignedUrl);

describe("Storage", () => {
  it("creates direct path-style and virtual-host URLs relative to its root", async () => {
    await expect(
      new Storage({
        bucket: "uploads",
        endpointUrl: "http://s3.local:9000",
        forcePathStyle: true,
        region: "us-east-1",
        rootPath: "tenant/assets",
      }).getUrl("images/hello world.png"),
    ).resolves.toBe(
      "http://s3.local:9000/uploads/tenant/assets/images/hello%20world.png",
    );
    await expect(
      new Storage({
        bucket: "uploads",
        endpointUrl: "https://s3.example.com",
        region: "us-east-1",
      }).getUrl("images/photo.png"),
    ).resolves.toBe("https://uploads.s3.example.com/images/photo.png");
    await expect(
      new Storage({ bucket: "uploads", region: "us-east-1" }).getUrl(
        "images/photo.png",
      ),
    ).resolves.toBe(
      "https://uploads.s3.us-east-1.amazonaws.com/images/photo.png",
    );
    await expect(
      new Storage({
        bucket: "uploads",
        bucketEndpoint: true,
        endpointUrl: "https://cdn.example.com/assets/",
        rootPath: "tenant",
      }).getUrl("images/hello world.png"),
    ).resolves.toBe(
      "https://cdn.example.com/assets/tenant/images/hello%20world.png",
    );
  });

  it("creates temporary read URLs with S3 response options", async () => {
    getSignedUrlMock
      .mockResolvedValueOnce("https://signed.example.com/file.txt")
      .mockResolvedValueOnce("https://signed.example.com/default.txt");
    const storage = new Storage({
      accessKeyId: "access-key",
      bucket: "uploads",
      bucketEndpoint: true,
      endpointUrl: "https://cdn.example.com",
      region: "us-east-1",
      rootPath: "private",
      secretAccessKey: "secret-key",
    });
    const { client } = storageClients(storage);

    await expect(
      storage.createTemporaryUrl("reports/file.txt", {
        expiresIn: 120,
        ResponseContentType: "text/plain",
      }),
    ).resolves.toBe("https://signed.example.com/file.txt");
    await expect(storage.createTemporaryUrl("default.txt")).resolves.toBe(
      "https://signed.example.com/default.txt",
    );

    const command = getSignedUrlMock.mock.calls[0]?.[1];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command?.input).toEqual({
      Bucket: "https://cdn.example.com",
      Key: "private/reports/file.txt",
      ResponseContentType: "text/plain",
    });
    expect(getSignedUrlMock).toHaveBeenNthCalledWith(1, client, command, {
      expiresIn: 120,
    });
    expect(getSignedUrlMock.mock.calls[1]?.[2]).toEqual({});
  });

  it("creates temporary uploads with scoped keys and enforced identity conditions", async () => {
    createPresignedPostMock
      .mockResolvedValueOnce({
        fields: { key: "private/tmp/photo.png", Policy: "policy" },
        url: "https://s3.example.com/uploads",
      })
      .mockResolvedValueOnce({
        fields: { key: "private/tmp/default.png" },
        url: "https://s3.example.com/uploads",
      });
    const storage = new Storage({
      bucket: "uploads",
      endpointUrl: "https://s3.example.com",
      rootPath: "private",
    });
    const { client } = storageClients(storage);

    await expect(
      storage.createTemporaryUploadUrl("tmp/photo.png", {
        conditions: [
          ["content-length-range", 1, 1024],
          ["eq", "$Content-Type", "image/png"],
        ],
        expiresIn: 300,
        fields: { "Content-Type": "image/png" },
      }),
    ).resolves.toEqual({
      fields: { key: "private/tmp/photo.png", Policy: "policy" },
      url: "https://s3.example.com/uploads",
    });
    await storage.createTemporaryUploadUrl("tmp/default.png");

    expect(createPresignedPostMock).toHaveBeenNthCalledWith(1, client, {
      Bucket: "uploads",
      Key: "private/tmp/photo.png",
      Conditions: [
        ["eq", "$bucket", "uploads"],
        ["eq", "$key", "private/tmp/photo.png"],
        ["content-length-range", 1, 1024],
        ["eq", "$Content-Type", "image/png"],
      ],
      Expires: 300,
      Fields: { "Content-Type": "image/png" },
    });
    expect(createPresignedPostMock).toHaveBeenNthCalledWith(2, client, {
      Bucket: "uploads",
      Key: "private/tmp/default.png",
      Conditions: [
        ["eq", "$bucket", "uploads"],
        ["eq", "$key", "private/tmp/default.png"],
      ],
    });
  });

  it("uses the configured bucket endpoint as the presigned POST target", async () => {
    createPresignedPostMock.mockResolvedValueOnce({
      fields: { bucket: "uploads", key: "tmp/photo.png" },
      url: "https://uploads.uploads.minio.example.com/",
    });
    const storage = new Storage({
      bucket: "uploads",
      bucketEndpoint: true,
      endpointUrl: "https://uploads.minio.example.com",
    });
    const { client } = storageClients(storage);

    await expect(
      storage.createTemporaryUploadUrl("tmp/photo.png"),
    ).resolves.toEqual({
      fields: { bucket: "uploads", key: "tmp/photo.png" },
      url: "https://uploads.minio.example.com/",
    });
    expect(createPresignedPostMock).toHaveBeenCalledWith(client, {
      Bucket: "uploads",
      Key: "tmp/photo.png",
      Conditions: [
        ["eq", "$bucket", "uploads"],
        ["eq", "$key", "tmp/photo.png"],
      ],
    });
  });

  it("uses independent bucket endpoints for external and internal clients", async () => {
    getSignedUrlMock.mockResolvedValueOnce(
      "https://uploads.public.example.com/file.txt?signature=test",
    );
    const { send, storage } = createStorage({
      bucket: "uploads",
      bucketEndpoint: true,
      endpointUrl: "https://uploads.public.example.com",
      internalBucketEndpoint: true,
      internalEndpointUrl: "https://uploads.internal.example.com",
    });

    await storage.writeFile("file.txt", "content");
    await storage.deleteFile("file.txt");
    await storage.createTemporaryUrl("file.txt");

    expect(commandAt(send, 0, PutObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com",
    );
    expect(commandAt(send, 1, DeleteObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com",
    );
    const signedCommand = getSignedUrlMock.mock.calls.at(-1)?.[1];
    expect(signedCommand).toBeInstanceOf(GetObjectCommand);
    expect(signedCommand?.input.Bucket).toBe(
      "https://uploads.public.example.com",
    );
  });

  it("writes, copies, moves, and deletes paths relative to its root", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "/tenant//assets/",
    });

    await storage.writeFile("/docs//hello world.txt", "hello", {
      ContentType: "text/plain",
    });
    await storage.copyFile("docs/hello world.txt", "archive/hello world.txt");
    await storage.moveFile("archive/hello world.txt", "final/hello world.txt");
    await storage.deleteFile("final/hello world.txt");

    expect(send).toHaveBeenCalledTimes(7);
    expect(commandAt(send, 0, PutObjectCommand).input).toEqual({
      Bucket: "test-bucket",
      Key: "tenant/assets/docs/hello world.txt",
      Body: Buffer.from("hello"),
      ContentType: "text/plain",
    });
    expect(commandAt(send, 1, HeadObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      Key: "tenant/assets/docs/hello world.txt",
    });
    expect(commandAt(send, 2, CopyObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      CopySource: "test-bucket/tenant/assets/docs/hello%20world.txt",
      Key: "tenant/assets/archive/hello world.txt",
    });
    expect(commandAt(send, 4, CopyObjectCommand).input).toMatchObject({
      CopySource: "test-bucket/tenant/assets/archive/hello%20world.txt",
      Key: "tenant/assets/final/hello world.txt",
    });
    expect(commandAt(send, 5, DeleteObjectCommand).input.Key).toBe(
      "tenant/assets/archive/hello world.txt",
    );
    expect(commandAt(send, 6, DeleteObjectCommand).input.Key).toBe(
      "tenant/assets/final/hello world.txt",
    );
  });

  it("treats moves to the same normalized key as a no-op", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });

    await storage.moveFile("docs/report.txt", "/docs//./report.txt");

    expect(send).not.toHaveBeenCalled();
  });

  it("enforces the 5 GB copy limit before copying", async () => {
    const maxCopySize = 5 * 1024 * 1024 * 1024;
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send
      .mockResolvedValueOnce({ ContentLength: maxCopySize })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: maxCopySize + 1 })
      .mockResolvedValueOnce({});

    await expect(
      storage.copyFile("maximum.bin", "maximum-copy.bin"),
    ).resolves.toBeUndefined();
    await expect(
      storage.copyFile("too-large.bin", "too-large-copy.bin"),
    ).rejects.toThrow("exceeds the 5 GB limit");
    await expect(
      storage.copyFile("unknown-size.bin", "unknown-size-copy.bin"),
    ).rejects.toThrow("did not return a content length");

    expect(send).toHaveBeenCalledTimes(4);
    expect(commandAt(send, 1, CopyObjectCommand).input).toMatchObject({
      CopySource: "test-bucket/maximum.bin",
      Key: "maximum-copy.bin",
    });
    expect(commandAt(send, 2, HeadObjectCommand).input.Key).toBe(
      "too-large.bin",
    );
    expect(commandAt(send, 3, HeadObjectCommand).input.Key).toBe(
      "unknown-size.bin",
    );
  });

  it("reads files as buffers, encoded strings, and byte-range streams", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });
    send
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () =>
            Promise.resolve(Uint8Array.from(Buffer.from("buffer"))),
        },
      })
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () =>
            Promise.resolve(Uint8Array.from(Buffer.from("encoded"))),
        },
      })
      .mockResolvedValueOnce({ Body: Readable.from(["range"]) });

    await expect(storage.readFile("buffer.txt")).resolves.toEqual(
      Buffer.from("buffer"),
    );
    await expect(storage.readFile("encoded.txt", "utf8")).resolves.toBe(
      "encoded",
    );
    await expect(
      streamText(
        storage.createReadStream("range.txt", {
          encoding: "utf8",
          start: 1,
          end: 3,
        }),
      ),
    ).resolves.toBe("range");

    expect(commandAt(send, 0, GetObjectCommand).input.Key).toBe(
      "root/buffer.txt",
    );
    expect(commandAt(send, 2, GetObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      Key: "root/range.txt",
      Range: "bytes=1-3",
    });
  });

  it("reports empty and invalid S3 response bodies and request failures", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: "not-a-node-stream" })
      .mockRejectedValueOnce("S3 unavailable");

    await expect(storage.readFile("empty.txt", null)).rejects.toThrow(
      "empty response body",
    );
    await expect(
      streamText(storage.createReadStream("invalid.txt", "utf8")),
    ).rejects.toThrow("non-Node.js stream body");
    await expect(
      streamText(storage.createReadStream("unavailable.txt")),
    ).rejects.toThrow("S3 unavailable");
  });

  it("supports open-ended ranges, direct buffer views, and abort signals", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send
      .mockResolvedValueOnce({ Body: Readable.from(["start"]) })
      .mockResolvedValueOnce({ Body: Readable.from(["end"]) });

    await expect(
      streamText(storage.createReadStream("start.txt", { start: 2 })),
    ).resolves.toBe("start");
    const controller = new AbortController();
    controller.abort("cancelled");
    await expect(
      streamText(
        storage.createReadStream("end.txt", {
          end: 2,
          signal: controller.signal,
        }),
      ),
    ).resolves.toBe("end");
    await storage.writeFile("bytes.bin", Uint8Array.from([1, 2, 3]), null);

    expect(commandAt(send, 0, GetObjectCommand).input.Range).toBe("bytes=2-");
    expect(commandAt(send, 1, GetObjectCommand).input.Range).toBe("bytes=0-2");
    expect(commandAt(send, 2, PutObjectCommand).input.Body).toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it("writes iterable data and waits for streaming uploads to complete", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });

    await storage.writeFile("iterable.txt", [
      "hello ",
      Uint8Array.from(Buffer.from("world")),
    ]);
    const stream = storage.createWriteStream("stream.txt", {
      ContentType: "text/plain",
      highWaterMark: 1,
    });
    stream.end("streamed");
    await finished(stream);

    expect(send).toHaveBeenCalledTimes(2);
    expect(commandAt(send, 0, PutObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      Key: "root/iterable.txt",
      Body: Buffer.from("hello world"),
    });
    expect(commandAt(send, 1, PutObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      Key: "root/stream.txt",
      Body: Buffer.from("streamed"),
      ContentType: "text/plain",
    });
  });

  it("propagates streaming upload failures", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send.mockRejectedValueOnce(new Error("upload failed"));
    const stream = storage.createWriteStream("stream.txt");

    stream.end("content");
    await expect(finished(stream)).rejects.toThrow("upload failed");
  });

  it("deletes arrays in S3-sized batches and reports per-object failures", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    const paths = Array.from(
      { length: 1001 },
      (_, index) => `${String(index)}.txt`,
    );

    await storage.deleteFile([]);
    await storage.deleteFile(paths);

    expect(send).toHaveBeenCalledTimes(2);
    expect(
      commandAt(send, 0, DeleteObjectsCommand).input.Delete?.Objects,
    ).toHaveLength(1000);
    expect(
      commandAt(send, 1, DeleteObjectsCommand).input.Delete?.Objects,
    ).toEqual([{ Key: "1000.txt" }]);

    send.mockResolvedValueOnce({
      Errors: [{ Key: "broken.txt", Code: "AccessDenied" }],
    });
    await expect(storage.deleteFile(["broken.txt"])).rejects.toThrow(
      "broken.txt (AccessDenied)",
    );

    send.mockResolvedValueOnce({ Errors: [{}] });
    await expect(storage.deleteFile(["unknown.txt"])).rejects.toThrow(
      "unknown (unknown)",
    );
  });

  it("lists immediate entries with metadata across paginated results", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });
    const lastModified = new Date("2026-01-01T00:00:00Z");
    send
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: "root/docs/z.txt",
            Size: 5,
            LastModified: lastModified,
            ETag: '"etag"',
          },
          { Key: "root/docs/empty/" },
        ],
        CommonPrefixes: [{ Prefix: "root/docs/nested/" }],
        IsTruncated: true,
        NextContinuationToken: "next",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "root/docs/a.txt", Size: 1 }],
        CommonPrefixes: [{ Prefix: "root/docs/other/" }],
        IsTruncated: false,
      });

    await expect(storage.listEntries("docs")).resolves.toEqual([
      { path: "docs/a.txt", type: "file", size: 1 },
      { path: "docs/empty", type: "directory" },
      { path: "docs/nested", type: "directory" },
      { path: "docs/other", type: "directory" },
      {
        path: "docs/z.txt",
        type: "file",
        size: 5,
        lastModified,
        etag: '"etag"',
      },
    ]);

    expect(commandAt(send, 0, ListObjectsV2Command).input).toMatchObject({
      Bucket: "test-bucket",
      Prefix: "root/docs/",
      Delimiter: "/",
    });
    expect(commandAt(send, 1, ListObjectsV2Command).input).toMatchObject({
      ContinuationToken: "next",
    });
  });

  it("recursively lists files and inferred directories", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });
    send
      .mockResolvedValueOnce({
        Contents: [
          { Key: "root/docs/a.txt" },
          { Key: "root/docs/guides/start.txt" },
          { Key: "root/docs/guides/api/reference.txt" },
          { Key: "root/docs/empty/" },
        ],
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "root/docs/guides/api/reference.txt" }],
      });

    await expect(
      storage.listEntries("docs", { recursive: true }),
    ).resolves.toEqual([
      { path: "docs/a.txt", type: "file" },
      { path: "docs/empty", type: "directory" },
      { path: "docs/guides", type: "directory" },
      { path: "docs/guides/api", type: "directory" },
      { path: "docs/guides/api/reference.txt", type: "file" },
      { path: "docs/guides/start.txt", type: "file" },
    ]);
    await expect(
      storage.listEntries("docs/guides", { recursive: true }),
    ).resolves.toEqual([
      { path: "docs/guides/api", type: "directory" },
      { path: "docs/guides/api/reference.txt", type: "file" },
    ]);
  });

  it("ignores incomplete list records and supports an unscoped root", async () => {
    const { send, storage: rootedStorage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });
    send.mockResolvedValueOnce({
      CommonPrefixes: [{}, { Prefix: "root/docs/" }],
      Contents: [{}, { Key: "root/docs/file.txt" }],
    });

    await expect(rootedStorage.listEntries("docs")).resolves.toEqual([
      { path: "docs/file.txt", type: "file" },
    ]);

    const unscoped = createStorage({ bucket: "test-bucket" });
    unscoped.send.mockResolvedValueOnce({ Contents: [{ Key: "file.txt" }] });
    await expect(
      unscoped.storage.listEntries("", {
        recursive: true,
      }),
    ).resolves.toEqual([{ path: "file.txt", type: "file" }]);
    expect(commandAt(unscoped.send, 0, ListObjectsV2Command).input.Prefix).toBe(
      "",
    );
  });

  it("rejects missing buckets, empty object paths, traversal, and invalid ranges", async () => {
    expect(() => new Storage({})).toThrow("Storage bucket is required");
    expect(
      () => new Storage({ bucket: "test-bucket", bucketEndpoint: true }),
    ).toThrow("bucketEndpoint requires endpointUrl");
    expect(
      () =>
        new Storage({
          bucket: "test-bucket",
          internalBucketEndpoint: true,
        }),
    ).toThrow("internalBucketEndpoint requires");
    const storage = new Storage({ bucket: "test-bucket" });
    await expect(storage.writeFile("/", "content")).rejects.toThrow(
      "Storage path must not be empty",
    );
    await expect(storage.listEntries("../private")).rejects.toThrow(
      "must not contain '..'",
    );
    expect(() => storage.createReadStream("a.txt", { start: -1 })).toThrow(
      "start must be a non-negative integer",
    );
    expect(() =>
      storage.createReadStream("a.txt", { start: 2, end: 1 }),
    ).toThrow("end must not be less than start");
  });

  it("rejects malformed pagination and objects outside the configured root", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "root",
    });

    send.mockResolvedValueOnce({ IsTruncated: true });
    await expect(storage.listEntries()).rejects.toThrow("continuation token");

    send.mockResolvedValueOnce({ Contents: [{ Key: "other/file.txt" }] });
    await expect(storage.listEntries("", { recursive: true })).rejects.toThrow(
      "outside the storage root",
    );
  });
});

function createStorage(options: StorageModuleOptions): {
  client: S3Client;
  send: ReturnType<typeof vi.fn>;
  storage: Storage;
} {
  const storage = new Storage({ region: "us-east-1", ...options });
  const { internalClient: client } = storageClients(storage);
  const send = vi.fn((command: unknown) =>
    Promise.resolve(
      command instanceof HeadObjectCommand ? { ContentLength: 0 } : {},
    ),
  );
  client.send = send as S3Client["send"];

  return { client, send, storage };
}

function storageClients(storage: Storage): {
  client: S3Client;
  internalClient: S3Client;
} {
  return storage as unknown as {
    client: S3Client;
    internalClient: S3Client;
  };
}

async function streamText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString();
}

function commandAt<T>(
  send: ReturnType<typeof vi.fn>,
  index: number,
  type: { prototype: T },
): T {
  const command = send.mock.calls[index]?.[0];
  expect(command).toBeInstanceOf(type);
  return command as T;
}
