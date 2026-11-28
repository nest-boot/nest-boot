import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";

import {
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { JwtService } from "@nest-boot/jwt";
import {
  BadRequestException,
  NotFoundException,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";

import { type StorageReadFileOptions } from "./interfaces/storage-file-options.interface.js";
import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import { RESOLVE_FILE_DOWNLOAD_URL } from "./storage.constants.js";
import { StorageService } from "./storage.service.js";
import { DEFAULT_STORAGE_UPLOAD_LIMITS } from "./storage-upload-limits.constants.js";
import { fetchExternalFile } from "./utils/fetch-external-file.util.js";

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("./utils/fetch-external-file.util.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("./utils/fetch-external-file.util.js")
    >();
  return {
    ...actual,
    fetchExternalFile: vi.fn(),
  };
});

const createPresignedPostMock = vi.mocked(createPresignedPost);
const getSignedUrlMock = vi.mocked(getSignedUrl);
const fetchExternalFileMock = vi.mocked(fetchExternalFile);

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const UUID_C = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const UUID_D = "8f14e45f-ceea-467a-a9a1-3b7e6b21a9e2";
const UUID_E = "9b2e5f1a-4c3d-4e8f-8a1b-2c3d4e5f6a7b";

describe("StorageService", () => {
  beforeEach(() => {
    for (const name of [
      "AWS_ENDPOINT_URL",
      "AWS_ENDPOINT_URL_S3",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_BUCKET",
      "STORAGE_BUCKET_ENDPOINT",
      "STORAGE_ENDPOINT_URL",
      "STORAGE_FORCE_PATH_STYLE",
      "STORAGE_INTERNAL_BUCKET_ENDPOINT",
      "STORAGE_INTERNAL_ENDPOINT_URL",
      "STORAGE_REGION",
      "STORAGE_ROOT_PATH",
      "STORAGE_SECRET_ACCESS_KEY",
    ]) {
      vi.stubEnv(name, "");
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("uses independent bucket endpoints for external presigning and internal S3 operations", async () => {
    const validQuery = freshAmzSignedQuery("1");
    const resourceUrl = `https://uploads.public.example.com/assets/tmp/${UUID_A}.png${validQuery}`;
    getSignedUrlMock
      .mockResolvedValueOnce(
        "https://uploads.public.example.com/file.txt?signature=test",
      )
      .mockResolvedValueOnce(resourceUrl);
    createPresignedPostMock.mockResolvedValueOnce({
      fields: { bucket: "uploads", key: `tmp/${UUID_A}.png` },
      url: "https://uploads.uploads.public.example.com/assets",
    });
    const exp = Math.floor(Date.now() / 1000) + 120;
    const jwt = {
      sign: vi.fn<JwtService["sign"]>(),
      verify: vi.fn<JwtService["verify"]>().mockResolvedValue({
        bucket: "uploads",
        exp,
        key: "files/2026/01/31/file.txt",
      }),
    } as unknown as JwtService;
    const storage = new StorageService(
      {
        bucket: "uploads",
        bucketEndpoint: true,
        endpointUrl: "https://uploads.public.example.com/assets/",
        internalBucketEndpoint: true,
        internalEndpointUrl: "https://uploads.internal.example.com/storage/",
        region: "us-east-1",
      },
      undefined,
      jwt,
    );
    const { internalClient } = storageClients(storage);
    const send = vi.fn((command: unknown) =>
      Promise.resolve(
        command instanceof HeadObjectCommand
          ? {
              ContentLength: 10,
              Metadata: stagedTokenMetadata(validQuery),
            }
          : {},
      ),
    );
    internalClient.send = send as S3Client["send"];

    const key = await storage.uploadFile("content", {
      contentType: "text/plain",
    });
    await storage.deleteFile(key);
    await storage[RESOLVE_FILE_DOWNLOAD_URL](
      "files/2026/01/31/file.txt",
      "jwt-token",
    );
    const uploadTarget = await storage.createTemporaryFileUploadUrl({
      name: "photo.png",
      fileSize: 64,
      mimeType: "image/png",
    });

    expect(uploadTarget.url).toBe("https://uploads.public.example.com/assets/");
    expect(uploadTarget.resourceUrl).toBe(resourceUrl);

    const promotedPublic = await storage.uploadFileFromUrl(
      uploadTarget.resourceUrl,
    );
    expect(promotedPublic).toMatch(
      /^files\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.png$/,
    );
    expect(promotedPublic).not.toContain(UUID_A);
    // Internal endpoint URLs are rejected on untrusted promotion rather than leaked to external fetch
    await expect(
      storage.uploadFileFromUrl(
        `https://uploads.internal.example.com/storage/tmp/${UUID_B}.png${validQuery}`,
      ),
    ).rejects.toThrow("Invalid or expired temporary file URL");

    expect(commandAt(send, 0, PutObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com/storage",
    );
    expect(commandAt(send, 0, PutObjectCommand).input.CacheControl).toBe(
      "no-store",
    );
    expect(commandAt(send, 1, DeleteObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com/storage",
    );
    expect(commandAt(send, 2, HeadObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com/storage",
    );
    expect(commandAt(send, 3, CopyObjectCommand).input.Bucket).toBe(
      "https://uploads.internal.example.com/storage",
    );
  });

  it("retrieves file metadata via statFile and returns null for missing objects", async () => {
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      rootPath: "tenant",
    });
    const lastModified = new Date("2026-06-01T00:00:00.000Z");
    send
      .mockResolvedValueOnce({
        ContentLength: 42,
        ContentType: "image/png",
        ETag: '"etag-1"',
        LastModified: lastModified,
        Metadata: { author: "alice" },
      })
      .mockResolvedValueOnce({ Metadata: {} })
      .mockRejectedValueOnce(
        Object.assign(new Error("missing"), { name: "NotFound" }),
      )
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockRejectedValueOnce(new Error("AccessDenied"))
      .mockRejectedValueOnce("raw-failure");

    await expect(storage.statFile("files/2026/06/01/u1.png")).resolves.toEqual({
      size: 42,
      contentType: "image/png",
      etag: '"etag-1"',
      lastModified,
      metadata: { author: "alice" },
    });
    await expect(storage.statFile("tmp/empty.bin")).resolves.toEqual({
      size: 0,
    });
    await expect(storage.statFile("tmp/missing-1.png")).resolves.toBeNull();
    await expect(storage.statFile("tmp/missing-2.png")).resolves.toBeNull();
    await expect(storage.statFile("tmp/forbidden.png")).rejects.toThrow(
      "AccessDenied",
    );
    await expect(storage.statFile("tmp/raw.png")).rejects.toBe("raw-failure");

    expect(commandAt(send, 0, HeadObjectCommand).input).toEqual({
      Bucket: "test-bucket",
      Key: "tenant/files/2026/06/01/u1.png",
    });
  });

  it("enforces 5 GB, maxFileSize, and allowedMimeTypes constraints when promoting temporary URLs", async () => {
    const maxCopySize = 5 * 1024 * 1024 * 1024;
    const signedQuery = freshAmzSignedQuery("valid");
    const validMeta = stagedTokenMetadata(signedQuery);
    const { send, storage } = createStorage({
      bucket: "test-bucket",
      endpointUrl: "http://s3.local:9000",
      forcePathStyle: true,
    });
    send
      .mockResolvedValueOnce({
        ContentLength: maxCopySize,
        ContentType: "image/png",
        Metadata: validMeta,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        ContentLength: maxCopySize + 1,
        Metadata: validMeta,
      })
      .mockResolvedValueOnce({ Metadata: validMeta })
      .mockResolvedValueOnce({
        ContentLength: 2048,
        ContentType: "image/png",
        Metadata: validMeta,
      })
      .mockResolvedValueOnce({
        ContentLength: 512,
        ContentType: "application/pdf",
        Metadata: validMeta,
      });

    await expect(
      storage.uploadFileFromUrl(
        `http://s3.local:9000/test-bucket/tmp/${UUID_A}.png${signedQuery}`,
        {
          allowedMimeTypes: ["image/*"],
          maxFileSize: maxCopySize,
        },
      ),
    ).resolves.toMatch(/^files\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    await expect(
      storage.uploadFileFromUrl(
        `http://s3.local:9000/test-bucket/tmp/${UUID_B}.bin${signedQuery}`,
      ),
    ).rejects.toThrow("exceeds the 5 GB limit");
    await expect(
      storage.uploadFileFromUrl(
        `http://s3.local:9000/test-bucket/tmp/${UUID_C}.bin${signedQuery}`,
      ),
    ).rejects.toThrow("did not return a content length");
    await expect(
      storage.uploadFileFromUrl(
        `http://s3.local:9000/test-bucket/tmp/${UUID_D}.png${signedQuery}`,
        { maxFileSize: 1024 },
      ),
    ).rejects.toThrow("Temporary file exceeds maximum size");
    await expect(
      storage.uploadFileFromUrl(
        `http://s3.local:9000/test-bucket/tmp/${UUID_E}.pdf${signedQuery}`,
        { allowedMimeTypes: ["image/*"] },
      ),
    ).rejects.toThrow("does not meet the requirements");
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

    await expect(storage.readFile("tmp/buffer.txt")).resolves.toEqual(
      Buffer.from("buffer"),
    );
    const dynamicReadOptions: StorageReadFileOptions = { encoding: "utf8" };
    const dynamicResult: Buffer | string = await storage.readFile(
      "tmp/encoded.txt",
      dynamicReadOptions,
    );
    expect(dynamicResult).toBe("encoded");
    await expect(
      streamText(
        storage.createReadStream("tmp/range.txt", {
          encoding: "utf8",
          start: 1,
          end: 3,
        }),
      ),
    ).resolves.toBe("range");

    expect(commandAt(send, 0, GetObjectCommand).input.Key).toBe(
      "root/tmp/buffer.txt",
    );
    expect(commandAt(send, 2, GetObjectCommand).input).toMatchObject({
      Bucket: "test-bucket",
      Key: "root/tmp/range.txt",
      Range: "bytes=1-3",
    });
  });

  it("reports empty and invalid S3 response bodies and request failures", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: "not-a-node-stream" })
      .mockRejectedValueOnce("S3 unavailable");

    await expect(storage.readFile("tmp/empty.txt", null)).rejects.toThrow(
      "empty response body",
    );
    await expect(
      streamText(storage.createReadStream("tmp/invalid.txt", "utf8")),
    ).rejects.toThrow("non-Node.js stream body");
    await expect(
      streamText(storage.createReadStream("tmp/unavailable.txt")),
    ).rejects.toThrow("S3 unavailable");
  });

  it("supports open-ended ranges, buffer views, iterables, and abort signals", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    send
      .mockResolvedValueOnce({ Body: Readable.from(["start"]) })
      .mockResolvedValueOnce({ Body: Readable.from(["end"]) })
      .mockResolvedValueOnce({ Body: Readable.from(["plain"]) });

    await expect(
      streamText(storage.createReadStream("tmp/start.txt", { start: 2 })),
    ).resolves.toBe("start");
    const controller = new AbortController();
    controller.abort("cancelled");
    await expect(
      streamText(
        storage.createReadStream("tmp/end.txt", {
          end: 2,
          signal: controller.signal,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      streamText(storage.createReadStream("tmp/plain.txt")),
    ).resolves.toBe("plain");

    await storage.uploadTemporaryFile(Uint8Array.from([1, 2, 3]), {
      contentType: "application/octet-stream",
    });
    await storage.uploadFile(
      ["hello ", Uint8Array.from(Buffer.from("world"))],
      { contentType: "text/plain" },
    );

    expect(commandAt(send, 0, GetObjectCommand).input.Range).toBe("bytes=2-");
    expect(commandAt(send, 1, GetObjectCommand).input.Range).toBe("bytes=0-2");
    expect(commandAt(send, 2, GetObjectCommand).input.Range).toBeUndefined();
    expect(commandAt(send, 3, PutObjectCommand).input.Body).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(commandAt(send, 4, PutObjectCommand).input.Body).toEqual(
      Buffer.from("hello world"),
    );
  });

  it("deletes single keys and S3-sized batches while reporting per-object failures", async () => {
    const { send, storage } = createStorage({ bucket: "test-bucket" });
    const paths = Array.from(
      { length: 1001 },
      (_, index) => `tmp/${String(index)}.txt`,
    );

    await storage.deleteFile([]);
    await storage.deleteFile(paths);

    expect(send).toHaveBeenCalledTimes(2);
    expect(
      commandAt(send, 0, DeleteObjectsCommand).input.Delete?.Objects,
    ).toHaveLength(1000);
    expect(
      commandAt(send, 1, DeleteObjectsCommand).input.Delete?.Objects,
    ).toEqual([{ Key: "tmp/1000.txt" }]);

    send.mockResolvedValueOnce({
      Errors: [{ Key: "tmp/broken.txt", Code: "AccessDenied" }],
    });
    await expect(storage.deleteFile(["tmp/broken.txt"])).rejects.toThrow(
      "tmp/broken.txt (AccessDenied)",
    );

    send.mockResolvedValueOnce({ Errors: [{}] });
    await expect(storage.deleteFile(["tmp/unknown.txt"])).rejects.toThrow(
      "unknown (unknown)",
    );
  });

  describe("managed tmp/ and files/ upload and uploadFileFromUrl workflows", () => {
    it.each([
      [["image/*"], "image/png", true],
      [["image/png", "application/pdf"], "application/pdf", true],
      [["image/{png,jpeg}"], "image/jpeg", true],
      [["image/@(png|jpeg)"], "image/png", true],
      [["image/*"], "application/pdf", false],
      [["image/{png,jpeg}"], "image/gif", false],
      [[], "image/png", false],
    ])(
      "matches MIME patterns %j against %s",
      async (patterns, mimeType, allowed) => {
        createPresignedPostMock.mockResolvedValueOnce({
          fields: { key: "tmp/generated", Policy: "policy" },
          url: "https://bucket.s3.local/uploads",
        });
        getSignedUrlMock.mockResolvedValueOnce(
          "https://bucket.s3.local/uploads/tmp/generated?X-Amz-Signature=1",
        );
        const storage = new StorageService({
          bucket: "uploads",
          upload: { limits: [{ fileSize: 1024, mimeTypes: patterns }] },
        });
        const result = storage.createTemporaryFileUploadUrl({
          fileSize: 512,
          mimeType,
          name: "upload",
        });

        if (allowed) {
          await expect(result).resolves.toMatchObject({
            resourceUrl:
              "https://bucket.s3.local/uploads/tmp/generated?X-Amz-Signature=1",
          });
          expect(createPresignedPostMock).toHaveBeenCalledOnce();
        } else {
          await expect(result).rejects.toBeInstanceOf(BadRequestException);
          expect(createPresignedPostMock).not.toHaveBeenCalled();
        }
      },
    );

    it("creates constrained temporary file upload targets with resourceUrl", async () => {
      createPresignedPostMock
        .mockResolvedValueOnce({
          fields: {
            Policy: "policy",
            "X-Amz-Signature": "signature",
            key: "tenant/tmp/generated.jpeg",
          },
          url: "https://bucket.s3.local/uploads",
        })
        .mockResolvedValueOnce({
          fields: {
            Policy: "policy-svg",
            "X-Amz-Signature": "signature-svg",
            key: "tenant/tmp/vector.svg",
          },
          url: "https://bucket.s3.local/uploads",
        });
      getSignedUrlMock
        .mockResolvedValueOnce(
          "https://bucket.s3.local/uploads/tenant/tmp/generated.jpeg?X-Amz-Signature=signed",
        )
        .mockResolvedValueOnce(
          "https://bucket.s3.local/uploads/tenant/tmp/vector.svg?X-Amz-Signature=signed-svg",
        );
      const storage = new StorageService({
        bucket: "uploads",
        rootPath: "tenant",
        upload: {
          expiresIn: 120,
          limits: [{ fileSize: 1024, mimeTypes: ["image/*"] }],
        },
      });

      const target = await storage.createTemporaryFileUploadUrl({
        fileSize: 512,
        mimeType: "image/jpeg",
        name: "avatar.jpeg",
      });
      await storage.createTemporaryFileUploadUrl({
        fileSize: 256,
        mimeType: "image/svg+xml",
        name: "vector.svg",
      });

      expect(target).toEqual({
        url: "https://bucket.s3.local/uploads",
        resourceUrl:
          "https://bucket.s3.local/uploads/tenant/tmp/generated.jpeg?X-Amz-Signature=signed",
        fields: [
          { name: "key", value: "tenant/tmp/generated.jpeg" },
          { name: "Policy", value: "policy" },
          { name: "X-Amz-Signature", value: "signature" },
        ],
      });
      const getCommand = getSignedUrlMock.mock.calls[0]?.[1];
      expect(getCommand).toBeInstanceOf(GetObjectCommand);
      expect(getCommand?.input).toEqual({
        Bucket: "uploads",
        Key: expect.stringMatching(/^tenant\/tmp\/.+\.jpeg$/),
        ResponseCacheControl: "no-store",
        ResponseContentDisposition: "inline",
        ResponseContentType: "image/jpeg",
      });
      const svgCommand = getSignedUrlMock.mock.calls[1]?.[1];
      expect(svgCommand).toBeInstanceOf(GetObjectCommand);
      expect(svgCommand?.input).toMatchObject({
        ResponseCacheControl: "no-store",
        ResponseContentDisposition: "attachment",
        ResponseContentType: "image/svg+xml",
      });
    });

    it("applies DEFAULT_STORAGE_UPLOAD_LIMITS out of the box and evaluates custom overrides in first-match order", async () => {
      createPresignedPostMock.mockResolvedValue({
        fields: { key: "tmp/generated.pdf" },
        url: "https://bucket.s3.local/uploads",
      });
      getSignedUrlMock.mockResolvedValue(
        "https://bucket.s3.local/uploads/tmp/generated.pdf?X-Amz-Signature=1",
      );

      const defaultStorage = new StorageService({ bucket: "uploads" });
      await expect(
        defaultStorage.createTemporaryFileUploadUrl({
          fileSize: 20 * 1024 * 1024,
          mimeType: "application/pdf",
          name: "guide.pdf",
        }),
      ).resolves.toMatchObject({ url: "https://bucket.s3.local/uploads" });
      await expect(
        defaultStorage.createTemporaryFileUploadUrl({
          fileSize: 1024,
          mimeType: "text/html",
          name: "xss.html",
        }),
      ).rejects.toThrow("The uploaded file does not meet the requirements");
      await expect(
        defaultStorage.createTemporaryFileUploadUrl({
          fileSize: 1024,
          mimeType: "image/svg+xml",
          name: "icon.svg",
        }),
      ).rejects.toThrow("The uploaded file does not meet the requirements");
      await expect(
        defaultStorage.createTemporaryFileUploadUrl({
          fileSize: 11 * 1024 * 1024,
          mimeType: "image/png",
          name: "huge.png",
        }),
      ).rejects.toThrow("The uploaded file does not meet the requirements");

      // First matching MIME rule wins even when a broader rule appears later
      const customizedStorage = new StorageService({
        bucket: "uploads",
        upload: {
          limits: [
            { fileSize: 1024, mimeTypes: ["image/png"] },
            ...DEFAULT_STORAGE_UPLOAD_LIMITS,
          ],
        },
      });
      await expect(
        customizedStorage.createTemporaryFileUploadUrl({
          fileSize: 2048,
          mimeType: "image/png",
          name: "avatar.png",
        }),
      ).rejects.toThrow("The uploaded file does not meet the requirements");
      await expect(
        customizedStorage.createTemporaryFileUploadUrl({
          fileSize: 2048,
          mimeType: "image/jpeg",
          name: "avatar.jpg",
        }),
      ).resolves.toMatchObject({ url: "https://bucket.s3.local/uploads" });
    });

    it("rejects malformed temporary upload requests", async () => {
      const storage = new StorageService({ bucket: "uploads" });

      await expect(
        storage.createTemporaryFileUploadUrl(null as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        storage.createTemporaryFileUploadUrl({
          fileSize: 100,
          mimeType: "image/png",
          name: "   ",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        storage.createTemporaryFileUploadUrl({
          fileSize: 0,
          mimeType: "image/png",
          name: "avatar.png",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("promotes verified UUIDv4 temporary S3 URLs onto fresh keys, honors extension overrides, and preserves headers", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const { send, storage } = createStorage({
        bucket: "uploads",
        endpointUrl: "http://s3.local:9000",
        forcePathStyle: true,
        rootPath: "tenant(archive)",
      });

      const signedSearch =
        "?X-Amz-Date=20260131T115500Z&X-Amz-Expires=600&X-Amz-Signature=sig-1";
      const sourceHead = {
        CacheControl: "private, max-age=60",
        ContentDisposition: 'attachment; filename="report.jpeg"',
        ContentEncoding: "gzip",
        ContentLanguage: "en-US",
        ContentLength: 64,
        ContentType: "image/jpeg",
        ETag: '"etag-photo"',
        Metadata: stagedTokenMetadata(signedSearch, { origin: "staged" }),
      };
      send
        .mockResolvedValueOnce(sourceHead)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(sourceHead)
        .mockResolvedValueOnce({});

      const tempResourceUrl = `http://s3.local:9000/uploads/tenant%28archive%29/tmp/${UUID_A}.jpeg${signedSearch}`;
      const firstKey = await storage.uploadFileFromUrl(tempResourceUrl);
      const secondKey = await storage.uploadFileFromUrl(tempResourceUrl, {
        extension: ".webp",
      });

      expect(firstKey).toMatch(/^files\/2026\/01\/31\/[0-9a-f-]{36}\.jpeg$/);
      expect(firstKey).not.toBe(`files/2026/01/31/${UUID_A}.jpeg`);
      expect(secondKey).toMatch(/^files\/2026\/01\/31\/[0-9a-f-]{36}\.webp$/);
      expect(secondKey).not.toBe(firstKey);
      await expect(
        storage.uploadFileFromUrl(tempResourceUrl, {
          extension: "bad/ext",
        }),
      ).rejects.toThrow("Invalid file extension");

      expect(fetchExternalFileMock).not.toHaveBeenCalled();
      expect(commandAt(send, 1, CopyObjectCommand).input).toEqual({
        Bucket: "uploads",
        CacheControl: "private, max-age=60",
        ContentDisposition: 'attachment; filename="report.jpeg"',
        ContentEncoding: "gzip",
        ContentLanguage: "en-US",
        ContentType: "image/jpeg",
        CopySource: `uploads/tenant%28archive%29/tmp/${UUID_A}.jpeg`,
        CopySourceIfMatch: '"etag-photo"',
        Key: `tenant(archive)/${firstKey}`,
        Metadata: { origin: "staged" },
        MetadataDirective: "REPLACE",
      });
      expect(commandAt(send, 3, CopyObjectCommand).input.Key).toBe(
        `tenant(archive)/${secondKey}`,
      );

      // Forces attachment disposition when promoting active content (such as SVG under custom limits)
      // and matches SDK endpoints configured via AWS_ENDPOINT_URL_S3 across STS credential rotations
      vi.stubEnv("AWS_ENDPOINT_URL_S3", "http://10.0.0.5:9000");
      const envS3Storage = createStorage({
        bucket: "uploads",
        forcePathStyle: true,
        upload: { limits: [{ fileSize: 1024, mimeTypes: ["image/*"] }] },
      });
      envS3Storage.send
        .mockResolvedValueOnce({
          ContentLength: 32,
          ContentType: "image/svg+xml",
          Metadata: stagedTokenMetadata(signedSearch),
        })
        .mockResolvedValueOnce({});
      const svgKey = await envS3Storage.storage.uploadFileFromUrl(
        `http://10.0.0.5:9000/uploads/tmp/${UUID_B}.svg${signedSearch}`,
      );
      expect(svgKey).toMatch(/^files\/2026\/01\/31\/[0-9a-f-]{36}\.svg$/);
      expect(
        commandAt(envS3Storage.send, 1, CopyObjectCommand).input
          .ContentDisposition,
      ).toBe("attachment");
    });

    it("streams external URLs directly into S3 Upload without disk staging", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const { send, storage } = createStorage({
        bucket: "uploads",
        rootPath: "tenant",
        ssrf: { allowedHosts: ["*.corp.internal"] },
        upload: { timeout: 15_000 },
      });

      const avatarStream = new PassThrough();
      avatarStream.write(Buffer.alloc(0));
      avatarStream.end(Buffer.from("avatar-bytes"));

      fetchExternalFileMock
        .mockResolvedValueOnce({
          contentType: "image/jpeg",
          pathname: "/u/12345",
          stream: avatarStream,
        })
        .mockResolvedValueOnce({
          contentType: "application/octet-stream",
          pathname: "/downloads/archive.pdf",
          stream: Readable.from([Buffer.from("pdf-bytes")]),
        })
        .mockResolvedValueOnce({
          pathname: "/opaque/blob",
          stream: Readable.from(["raw-bytes"]),
        })
        .mockResolvedValueOnce({
          contentType: "application/octet-stream",
          pathname: "/custom",
          stream: Readable.from([Buffer.from("custom-bytes")]),
        });

      const avatarKey = await storage.uploadFileFromUrl(
        "https://avatars.example.com/u/12345",
        { allowedMimeTypes: ["image/*"], maxFileSize: 1024 },
      );
      const pdfKey = await storage.uploadFileFromUrl(
        "https://cdn.example.com/downloads/archive.pdf",
      );
      const binKey = await storage.uploadFileFromUrl(
        "https://cdn.example.com/opaque/blob",
        { allowedMimeTypes: ["application/octet-stream"] },
      );
      const explicitKey = await storage.uploadFileFromUrl(
        "https://cdn.example.com/custom",
        { allowedMimeTypes: ["*/*"], extension: ".webp" },
      );

      expect(avatarKey).toMatch(/^files\/2026\/01\/31\/[^/]+\.jpe?g$/);
      expect(pdfKey).toMatch(/^files\/2026\/01\/31\/[^/]+\.pdf$/);
      expect(binKey).toMatch(/^files\/2026\/01\/31\/[^/]+\.bin$/);
      expect(explicitKey).toMatch(/^files\/2026\/01\/31\/[^/]+\.webp$/);
      expect(fetchExternalFileMock).toHaveBeenCalledWith(
        "https://avatars.example.com/u/12345",
        expect.objectContaining({
          maxFileSize: 1024,
          ssrf: expect.objectContaining({ enabled: true }),
          timeout: expect.any(Number) as number,
        }),
      );
      expect(commandAt(send, 0, PutObjectCommand).input).toMatchObject({
        Body: Buffer.from("avatar-bytes"),
        Bucket: "uploads",
        ContentType: "image/jpeg",
        Key: `tenant/${avatarKey}`,
      });
    });

    it("rejects invalid URLs, disallowed MIME types, empty streams, and stream errors without uploading", async () => {
      const { send, storage } = createStorage({
        bucket: "uploads",
        endpointUrl: "http://s3.local:9000",
        forcePathStyle: true,
      });

      for (const invalidUrl of [
        "",
        "not a url",
        "ftp://example.com/a.png",
        "/other-bucket/tmp/a.png",
        `/uploads/tmp/${UUID_A}.png`,
        `http://s3.local:9000/uploads/tmp/${UUID_A}.png`,
        "http://s3.local:9000/uploads/tmp/predictable.png?X-Amz-Signature=1",
        `http://s3.local:9000/uploads/tmp/${UUID_A}.png?X-Amz-Date=20200101T000000Z&X-Amz-Expires=60&X-Amz-Signature=1`,
        `http://s3.local:9000/uploads/tmp/${UUID_A}.png?X-Amz-Date=bad&X-Amz-Expires=60&X-Amz-Signature=1`,
        "http://s3.local:9000/uploads/tmp/",
        `http://s3.local:9000/uploads/tmp/nested/${UUID_A}.png?X-Amz-Signature=1`,
        "http://s3.local:9000/uploads/tmp/%E0%A4%A?X-Amz-Signature=1",
        "http://s3.local:9000/uploads/tmp/a%2Fb.png?X-Amz-Signature=1",
        "http://s3.local:9000/uploads/tmp/a%5Cb.png?X-Amz-Signature=1",
      ]) {
        await expect(
          storage.uploadFileFromUrl(invalidUrl),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      // Rejects missing S3 tmp object, tampered query signature, or smuggled unsigned query parameter
      const validSignedQuery = freshAmzSignedQuery("original");
      send
        .mockRejectedValueOnce(
          Object.assign(new Error("missing"), { name: "NotFound" }),
        )
        .mockResolvedValueOnce({
          ContentLength: 32,
          ContentType: "image/png",
          Metadata: stagedTokenMetadata(validSignedQuery),
        })
        .mockResolvedValueOnce({
          ContentLength: 32,
          ContentType: "image/png",
          Metadata: stagedTokenMetadata(validSignedQuery),
        });
      await expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png${validSignedQuery}`,
        ),
      ).rejects.toThrow("Temporary file not found");
      await expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png${validSignedQuery.replace("sig-original", "sig-tampered")}`,
        ),
      ).rejects.toThrow("Invalid or expired temporary file URL");
      await expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png${validSignedQuery}&extra=1`,
        ),
      ).rejects.toThrow("Invalid or expired temporary file URL");
      send.mockClear();

      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "application/pdf",
        pathname: "/doc.pdf",
        stream: Readable.from([Buffer.from("pdf")]),
      });
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/doc.pdf", {
          allowedMimeTypes: ["!application/pdf"],
        }),
      ).rejects.toThrow(
        "Storage upload allowedMimeTypes must not use negation",
      );

      // Default upload.limits rejects active HTML and opaque binaries on uploadFileFromUrl when allowedMimeTypes is omitted
      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "text/html",
        pathname: "/page.html",
        stream: Readable.from([Buffer.from("<script>")]),
      });
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/page.html"),
      ).rejects.toThrow("The remote file does not meet the requirements");
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/a.png", {
          maxFileSize: 0,
        }),
      ).rejects.toThrow(
        "Storage upload maxFileSize must be a positive integer",
      );

      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "image/png",
        pathname: "/empty.png",
        stream: Readable.from([]),
      });
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/empty.png"),
      ).rejects.toThrow("External file must not be empty");

      const closedStream = new PassThrough();
      setImmediate(() => {
        closedStream.destroy();
      });
      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "image/png",
        pathname: "/aborted.png",
        stream: closedStream,
      });
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/aborted.png"),
      ).rejects.toThrow("External file download aborted");

      const errorStream = new PassThrough();
      setImmediate(() => {
        errorStream.destroy(
          new BadRequestException("External file exceeds maximum size"),
        );
      });
      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "image/png",
        pathname: "/oversized.png",
        stream: errorStream,
      });
      await expect(
        storage.uploadFileFromUrl("https://cdn.example.com/oversized.png"),
      ).rejects.toThrow("External file exceeds maximum size");

      // Stream error emitted synchronously during handoff after first chunk is peeked must reject cleanly without unhandled error
      const handoffStream = new PassThrough();
      handoffStream.write(Buffer.from("head"));
      handoffStream.on("removeListener", (event) => {
        if (event === "readable" && !handoffStream.destroyed) {
          handoffStream.destroy(
            new BadRequestException("External file exceeds maximum size"),
          );
        }
      });
      fetchExternalFileMock.mockResolvedValueOnce({
        contentType: "image/png",
        pathname: "/handoff-oversized.png",
        stream: handoffStream,
      });
      await expect(
        storage.uploadFileFromUrl(
          "https://cdn.example.com/handoff-oversized.png",
        ),
      ).rejects.toThrow("External file exceeds maximum size");

      expect(send).not.toHaveBeenCalled();
    });

    it("uploads server-side temporary files into tmp/ and permanent files into files/YYYY/MM/DD/", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const { send, storage } = createStorage({
        bucket: "uploads",
        rootPath: "tenant",
      });

      const tempKey = await storage.uploadTemporaryFile("hello", {
        contentType: "image/png",
        Metadata: { source: "test" },
      });
      const fallbackKey = await storage.uploadTemporaryFile("bytes", {
        contentType: "unknown/unknown",
      });
      const permanentKey = await storage.uploadFile(
        Readable.from([Buffer.from("doc")]),
        {
          contentType: "application/octet-stream",
          extension: ".pdf",
        },
      );

      expect(tempKey).toMatch(/^tmp\/[^/]+\.png$/);
      expect(fallbackKey).toMatch(/^tmp\/[^/]+\.bin$/);
      expect(permanentKey).toMatch(/^files\/2026\/01\/31\/[^/]+\.pdf$/);
      expect(commandAt(send, 0, PutObjectCommand).input).toMatchObject({
        Bucket: "uploads",
        Key: `tenant/${tempKey}`,
        ContentType: "image/png",
        Metadata: { source: "test" },
      });

      await expect(
        storage.uploadTemporaryFile("bad", { contentType: "   " }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        storage.uploadFile("bad", {
          contentType: "text/plain",
          extension: "nested/ext",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("enforces module upload.timeout and per-call timeout overrides across uploadFile, uploadTemporaryFile, and uploadFileFromUrl", async () => {
      vi.useFakeTimers();
      const { send, storage } = createStorage({
        bucket: "uploads",
        endpointUrl: "http://s3.local:9000",
        forcePathStyle: true,
        upload: { timeout: 1_000 },
      });

      await expect(
        storage.uploadFile("data", { contentType: "text/plain", timeout: 0 }),
      ).rejects.toThrow("Storage upload timeout must be a positive integer");
      await expect(
        storage.uploadTemporaryFile("data", {
          contentType: "text/plain",
          timeout: -10,
        }),
      ).rejects.toThrow("Storage upload timeout must be a positive integer");
      await expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png?X-Amz-Signature=1`,
          {
            timeout: 0,
          },
        ),
      ).rejects.toThrow("Storage upload timeout must be a positive integer");

      const preAborted = new AbortController();
      preAborted.abort(new Error("Caller cancelled"));
      const unattachedReadable = new PassThrough();
      await expect(
        storage.uploadFile(unattachedReadable, {
          contentType: "text/plain",
          signal: preAborted.signal,
        }),
      ).rejects.toThrow("Caller cancelled");
      expect(unattachedReadable.destroyed).toBe(true);

      send.mockImplementation(
        (command: unknown, requestOptions?: { abortSignal?: AbortSignal }) => {
          const abortSignal = requestOptions?.abortSignal;
          if (!abortSignal) {
            return Promise.resolve(
              command instanceof HeadObjectCommand
                ? { VersionId: "uncertain-v1" }
                : {},
            );
          }
          return new Promise((_resolve, reject) => {
            if (abortSignal.aborted) {
              reject(
                abortSignal.reason instanceof Error
                  ? abortSignal.reason
                  : new Error("Aborted"),
              );
              return;
            }
            abortSignal.addEventListener(
              "abort",
              () => {
                reject(new Error("AbortError"));
              },
              { once: true },
            );
          });
        },
      );

      const uploadAssertion = expect(
        storage.uploadFile("slow", { contentType: "text/plain" }),
      ).rejects.toThrow("Storage upload timed out after 1000ms");
      await vi.advanceTimersByTimeAsync(1_000);
      await uploadAssertion;

      // Stalled Readable source is destroyed when upload timeout expires
      const stalledSource = new PassThrough();
      stalledSource.write(Buffer.from("partial"));
      const stalledAssertion = expect(
        storage.uploadTemporaryFile(stalledSource, {
          contentType: "text/plain",
          timeout: 250,
        }),
      ).rejects.toThrow("Storage upload timed out after 250ms");
      await vi.advanceTimersByTimeAsync(250);
      await stalledAssertion;
      expect(stalledSource.destroyed).toBe(true);

      const validTimeoutQuery = freshAmzSignedQuery("timeout");
      const copyAssertion = expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png${validTimeoutQuery}`,
          {
            timeout: 400,
          },
        ),
      ).rejects.toThrow("Storage upload timed out after 400ms");
      await vi.advanceTimersByTimeAsync(400);
      await copyAssertion;

      // Late CreateMultipartUpload finishing during cancellation is aborted cleanly
      let resolveLateCreateMpu:
        | ((value: { UploadId: string }) => void)
        | undefined;
      send.mockImplementation((command: unknown) => {
        if (command instanceof CreateMultipartUploadCommand) {
          return new Promise((resolve) => {
            resolveLateCreateMpu = resolve;
          });
        }
        return Promise.resolve({});
      });

      const multiPartBody = Buffer.alloc(6 * 1024 * 1024, 1);
      const lateMpuAssertion = expect(
        storage.uploadFile(multiPartBody, {
          contentType: "application/octet-stream",
          timeout: 100,
        }),
      ).rejects.toThrow("Storage upload timed out after 100ms");
      await vi.advanceTimersByTimeAsync(100);
      await lateMpuAssertion;
      resolveLateCreateMpu?.({ UploadId: "orphaned-upload-id" });
      await Promise.resolve();
      expect(
        send.mock.calls.some(
          ([cmd]) => cmd instanceof AbortMultipartUploadCommand,
        ),
      ).toBe(true);

      // Enforces deadline even when S3 credential resolution hangs without observing abortSignal
      send.mockImplementation(() => new Promise<never>(() => undefined));
      const stalledCredAssertion = expect(
        storage.uploadFileFromUrl(
          `http://s3.local:9000/uploads/tmp/${UUID_A}.png${validTimeoutQuery}`,
          { timeout: 150 },
        ),
      ).rejects.toThrow("Storage upload timed out after 150ms");
      await vi.advanceTimersByTimeAsync(150);
      await stalledCredAssertion;
    });
  });

  describe("signed file download links", () => {
    it("signs, parses, and exchanges download URLs while honoring global prefix exclusions", async () => {
      getSignedUrlMock.mockResolvedValueOnce(
        "https://s3.example.com/signed-get",
      );
      const config = new ApplicationConfig();
      config.setGlobalPrefix("api");
      config.setGlobalPrefixOptions({
        exclude: [
          {
            path: "/downloads/*key",
            pathRegex: /^\/downloads\/.+$/,
            requestMethod: RequestMethod.POST,
          },
          {
            path: "/downloads/*key",
            pathRegex: /^\/downloads\/.+$/,
            requestMethod: RequestMethod.GET,
          },
        ],
      });
      const exp = Math.floor(Date.now() / 1000) + 90;
      const jwt = {
        sign: vi.fn<JwtService["sign"]>().mockResolvedValue("jwt-token"),
        verify: vi.fn<JwtService["verify"]>().mockResolvedValue({
          bucket: "uploads",
          rootPath: "tenant",
          key: "files/2026/01/31/report.pdf",
          exp,
        }),
      } as unknown as JwtService;
      const storage = new StorageService(
        {
          bucket: "uploads",
          rootPath: "tenant",
          download: {
            baseURL: "https://downloads.example.com/gateway/",
            resolveContentType: (key) =>
              key.endsWith(".pdf") ? "application/pdf" : null,
          },
        },
        config,
        jwt,
      );

      const url = await storage.createFileDownloadUrl(
        "files/2026/01/31/report.pdf",
        { subject: "user:1", expiresIn: 180 },
      );
      expect(url).toBe(
        "https://downloads.example.com/gateway/downloads/files/2026/01/31/report.pdf?token=jwt-token",
      );
      expect(storage.parseFileDownloadUrl(url)).toBe(
        "files/2026/01/31/report.pdf",
      );
      expect(
        storage.parseFileDownloadUrl(
          "/downloads/files/2026/01/31/report.pdf?token=jwt-token",
        ),
      ).toBe("files/2026/01/31/report.pdf");
      expect(
        storage.parseFileDownloadUrl(
          "https://downloads.example.com/downloads/files/2026/01/31/report.pdf",
        ),
      ).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl(
          "/api/downloads/files/2026/01/31/report.pdf",
        ),
      ).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl(
          "https://other.example.com/downloads/files/2026/01/31/report.pdf",
        ),
      ).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl("//evil.example.com/downloads/a.pdf"),
      ).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl(
          "ftp://downloads.example.com/downloads/a.pdf",
        ),
      ).toBeUndefined();
      expect(storage.parseFileDownloadUrl("not a url")).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl("/downloads/%E0%A4%A"),
      ).toBeUndefined();
      expect(
        storage.parseFileDownloadUrl("/downloads/a%5Cb.pdf"),
      ).toBeUndefined();

      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL](
          "files/2026/01/31/report.pdf",
          "jwt-token",
        ),
      ).resolves.toBe("https://s3.example.com/signed-get");
      const downloadGetCommand = getSignedUrlMock.mock.calls[0]?.[1];
      expect(downloadGetCommand).toBeInstanceOf(GetObjectCommand);
      expect(downloadGetCommand?.input).toEqual({
        Bucket: "uploads",
        Key: "tenant/files/2026/01/31/report.pdf",
        ResponseCacheControl: "no-store",
        ResponseContentType: "application/pdf",
      });
    });

    it("rejects disabled, malformed, expired, and disallowed download operations", async () => {
      const disabled = new StorageService({
        bucket: "uploads",
        download: { enabled: false },
      });
      expect(disabled.parseFileDownloadUrl("/downloads/a.txt")).toBeUndefined();
      await expect(
        disabled.createFileDownloadUrl("a.txt", { subject: "user:1" }),
      ).rejects.toThrow("Storage downloads are disabled");
      await expect(
        disabled[RESOLVE_FILE_DOWNLOAD_URL]("a.txt", "token"),
      ).rejects.toThrow(NotFoundException);

      const withoutJwt = new StorageService({ bucket: "uploads" });
      await expect(
        withoutJwt.createFileDownloadUrl("a.txt", { subject: "user:1" }),
      ).rejects.toThrow("Storage download links require JwtModule");

      const verify = vi.fn<JwtService["verify"]>();
      const jwt = {
        sign: vi.fn<JwtService["sign"]>(),
        verify,
      } as unknown as JwtService;
      const storage = new StorageService(
        {
          bucket: "uploads",
          download: {
            resolveContentType: (key) =>
              key.endsWith(".png") ? "image/png" : null,
          },
        },
        undefined,
        jwt,
      );

      await expect(
        storage.createFileDownloadUrl("a.png", { subject: "   " }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        storage.createFileDownloadUrl("a.png", {
          subject: "user:1",
          expiresIn: 0,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        storage.createFileDownloadUrl("", { subject: "user:1" }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        storage.createFileDownloadUrl("blocked.txt", { subject: "user:1" }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL]("a.png", undefined),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL]("a\\b.png", "token"),
      ).rejects.toThrow(UnauthorizedException);

      verify.mockResolvedValueOnce({ bucket: "uploads", key: "a.png" });
      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL]("a.png", "token"),
      ).rejects.toThrow(UnauthorizedException);

      verify.mockResolvedValueOnce({
        bucket: "uploads",
        key: "a.png",
        exp: Math.floor(Date.now() / 1000) - 1,
      });
      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL]("a.png", "token"),
      ).rejects.toThrow(UnauthorizedException);

      verify.mockResolvedValueOnce({
        bucket: "uploads",
        key: "blocked.txt",
        exp: Math.floor(Date.now() / 1000) + 60,
      });
      await expect(
        storage[RESOLVE_FILE_DOWNLOAD_URL]("blocked.txt", "token"),
      ).rejects.toThrow(UnauthorizedException);

      // Forces attachment ResponseContentDisposition for active/non-previewable MIME types
      getSignedUrlMock.mockResolvedValueOnce(
        "https://s3.example.com/signed-svg",
      );
      const svgStorage = new StorageService(
        { bucket: "uploads" },
        undefined,
        jwt,
      );
      verify.mockResolvedValueOnce({
        bucket: "uploads",
        key: "vector.svg",
        exp: Math.floor(Date.now() / 1000) + 60,
      });
      await expect(
        svgStorage[RESOLVE_FILE_DOWNLOAD_URL]("vector.svg", "token"),
      ).resolves.toBe("https://s3.example.com/signed-svg");
      expect(getSignedUrlMock.mock.calls.at(-1)?.[1]?.input).toMatchObject({
        Key: "vector.svg",
        ResponseCacheControl: "no-store",
        ResponseContentDisposition: "attachment",
      });
    });
  });

  it("validates storage, upload, and download options in constructor", async () => {
    expect(() => new StorageService({})).toThrow("Storage bucket is required");
    expect(
      () => new StorageService({ bucket: "test-bucket", bucketEndpoint: true }),
    ).toThrow("bucketEndpoint requires endpointUrl");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          internalBucketEndpoint: true,
        }),
    ).toThrow("internalBucketEndpoint requires");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: { expiresIn: 0 },
        }),
    ).toThrow("Storage upload expiry must be between 1 and 604800 seconds");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: { timeout: 0 },
        }),
    ).toThrow("Storage upload timeout must be a positive integer");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: { limits: "bad" as never },
        }),
    ).toThrow("Storage upload limits must be an array");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: { limits: [{ fileSize: 0, mimeTypes: ["image/*"] }] },
        }),
    ).toThrow("Storage upload limit fileSize must be a positive integer");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: { limits: [{ fileSize: 1024, mimeTypes: ["   "] }] },
        }),
    ).toThrow("Storage upload limit mimeTypes must contain non-empty patterns");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          upload: {
            limits: [{ fileSize: 1024, mimeTypes: ["!image/svg+xml"] }],
          },
        }),
    ).toThrow("Storage upload limit mimeTypes must not use negation");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          download: { baseURL: "ftp://files.example.com" },
        }),
    ).toThrow("Storage download baseURL must use HTTP or HTTPS");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          download: { baseURL: "https://files.example.com/prefix?bad=1" },
        }),
    ).toThrow("Storage download baseURL must not include query or hash");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          download: { expiresIn: 604_801 },
        }),
    ).toThrow("Storage download expiry must be between 1 and 604800 seconds");
    expect(
      () =>
        new StorageService({
          bucket: "test-bucket",
          ssrf: { allowedHosts: [""] },
        }),
    ).toThrow(
      "Storage SSRF allowedHosts entries must be non-empty host or IP patterns",
    );

    const storage = new StorageService({ bucket: "test-bucket" });
    await expect(storage.readFile("/")).rejects.toThrow(
      "Storage path must not be empty",
    );
    await expect(storage.readFile("../private")).rejects.toThrow(
      "must not contain '..'",
    );
    expect(() => storage.createReadStream("tmp/a.txt", { start: -1 })).toThrow(
      "start must be a non-negative integer",
    );
    expect(() =>
      storage.createReadStream("tmp/a.txt", { start: 2, end: 1 }),
    ).toThrow("end must not be less than start");
  });
});

type MockSend = ReturnType<
  typeof vi.fn<
    (
      command: unknown,
      options?: { abortSignal?: AbortSignal },
    ) => Promise<unknown>
  >
>;

/**
 * Returns storage fixture and its mocked file operations.
 * @param options - Configuration for this operation.
 * @returns Storage fixture and its mocked file operations.
 */
function createStorage(options: StorageModuleOptions): {
  client: S3Client;
  send: MockSend;
  storage: StorageService;
} {
  const storage = new StorageService({ region: "us-east-1", ...options });
  const { internalClient: client } = storageClients(storage);
  const send: MockSend = vi.fn((command: unknown) =>
    Promise.resolve(
      command instanceof HeadObjectCommand ? { ContentLength: 0 } : {},
    ),
  );
  client.send = send as S3Client["send"];

  return { client, send, storage };
}

/**
 * Returns public and internal S3 clients used by the storage instance.
 * @param storage - Storage service used for file operations.
 * @returns Public and internal S3 clients used by the storage instance.
 */
function storageClients(storage: StorageService): {
  client: S3Client;
  internalClient: S3Client;
} {
  return storage as unknown as {
    client: S3Client;
    internalClient: S3Client;
  };
}

/**
 * Returns UTF-8 text read from the stream.
 * @param stream - Readable stream to consume.
 * @returns UTF-8 text read from the stream.
 */
async function streamText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString();
}

/**
 * Returns captured S3 command after verifying its type.
 * @param send - Mock that captures S3 commands.
 * @param index - Zero-based command index.
 * @param type - Type used to interpret the value.
 * @param type.prototype - Prototype of the expected command type.
 * @returns Captured S3 command after verifying its type.
 */
function commandAt<T>(
  send: MockSend,
  index: number,
  type: { prototype: T },
): T {
  const command = send.mock.calls[index]?.[0];
  expect(command).toBeInstanceOf(type);
  return command as T;
}

/**
 * Builds a fresh SigV4-shaped query string anchored at `Date.now()`.
 * @param tag - Signature suffix tag.
 * @returns Query string beginning with `?`.
 */
function freshAmzSignedQuery(tag: string): string {
  const iso = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `?X-Amz-Date=${iso}&X-Amz-Expires=3600&X-Amz-Signature=sig-${tag}`;
}

/**
 * Builds S3 user metadata matching a signed temporary `resourceUrl` query string.
 * @param search - Signed query string beginning with `?`.
 * @param extra - Optional user metadata entries.
 * @returns Mock S3 `HeadObjectOutput.Metadata` dictionary.
 */
function stagedTokenMetadata(
  search: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    ...extra,
    "storage-upload-token": createHash("sha256").update(search).digest("hex"),
  };
}
