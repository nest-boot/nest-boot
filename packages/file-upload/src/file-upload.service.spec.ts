import {
  CopyObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Readable } from "stream";

import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition.js";
import { FileUploadService } from "./file-upload.service.js";
import { type FileUploadModuleOptions } from "./file-upload-options.interface.js";

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(),
}));

const createPresignedPostMock = vi.mocked(createPresignedPost);

function createClient(
  options: {
    endpoint?: string;
    forcePathStyle?: boolean;
  } = {},
) {
  return createClientWithSend(options).client;
}

function createClientWithSend(
  options: {
    endpoint?: string;
    forcePathStyle?: boolean;
  } = {},
) {
  const client = new S3Client({
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    region: "us-east-1",
  });
  const send = vi.spyOn(client, "send").mockResolvedValue({} as never);

  return { client, send };
}

describe("FileUploadService", () => {
  beforeEach(() => {
    createPresignedPostMock.mockResolvedValue({
      fields: {
        key: "tmp/generated.jpeg",
        Policy: "policy",
        "X-Amz-Signature": "signature",
      },
      url: "https://bucket.s3.local/tmp/generated.jpeg?uploads=1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("create", () => {
    it("should create presigned upload arguments with limits and a custom public URL", async () => {
      const client = createClient();
      const service = await createService({
        bucket: "uploads",
        client,
        expires: 120,
        limits: [
          {
            fileSize: 1024,
            mimeTypes: ["image/*"],
          },
        ],
        url: "https://cdn.example.com/static",
      });

      await expect(
        service.create([
          {
            fileSize: 512,
            mimeType: "image/jpeg",
            name: "avatar.jpeg",
          },
        ]),
      ).resolves.toEqual([
        {
          fields: [
            {
              name: "key",
              value: "tmp/generated.jpeg",
            },
            {
              name: "Policy",
              value: "policy",
            },
            {
              name: "X-Amz-Signature",
              value: "signature",
            },
          ],
          url: "https://cdn.example.com/static/tmp/generated.jpeg?uploads=1",
        },
      ]);

      expect(createPresignedPostMock).toHaveBeenCalledWith(client, {
        Bucket: "uploads",
        Conditions: [
          ["content-length-range", 1, 1024],
          ["eq", "$bucket", "uploads"],
          ["eq", "$key", expect.stringMatching(/^tmp\/.+\.jpeg$/)],
          ["eq", "$success_action_status", "201"],
          ["eq", "$Content-Type", "image/jpeg"],
        ],
        Expires: 120,
        Fields: {
          "Content-Type": "image/jpeg",
          success_action_status: "201",
        },
        Key: expect.stringMatching(/^tmp\/.+\.jpeg$/),
      });
    });

    it("should use the original presigned URL and default expiration when limits are not configured", async () => {
      const service = await createService({
        bucket: "uploads",
        client: createClient(),
      });

      await expect(
        service.create([
          {
            fileSize: 512,
            mimeType: "text/plain",
            name: "notes",
          },
        ]),
      ).resolves.toEqual([
        {
          fields: [
            {
              name: "key",
              value: "tmp/generated.jpeg",
            },
            {
              name: "Policy",
              value: "policy",
            },
            {
              name: "X-Amz-Signature",
              value: "signature",
            },
          ],
          url: "https://bucket.s3.local/tmp/generated.jpeg?uploads=1",
        },
      ]);

      expect(createPresignedPostMock).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.objectContaining({
          Conditions: [
            ["eq", "$bucket", "uploads"],
            ["eq", "$key", expect.stringMatching(/^tmp\/.+$/)],
            ["eq", "$success_action_status", "201"],
            ["eq", "$Content-Type", "text/plain"],
          ],
          Expires: 3600,
        }),
      );
    });

    it("should reject uploads that do not match configured limits", async () => {
      const service = await createService({
        bucket: "uploads",
        client: createClient(),
        limits: [
          {
            fileSize: 100,
            mimeTypes: ["image/png"],
          },
        ],
      });

      await expect(
        service.create([
          {
            fileSize: 101,
            mimeType: "image/jpeg",
            name: "avatar.jpeg",
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(createPresignedPostMock).not.toHaveBeenCalled();
    });
  });

  describe("persist", () => {
    it("should copy a temporary file to the dated permanent file path", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const { client, send } = createClientWithSend({
        endpoint: "http://s3.local:9000",
        forcePathStyle: true,
      });
      const service = await createService({
        bucket: "uploads",
        client,
      });

      await expect(
        service.persist("http://s3.local:9000/uploads/tmp/photo.jpeg"),
      ).resolves.toBe(
        "http://s3.local:9000/uploads/files/2026/01/31/photo.jpeg",
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(CopyObjectCommand);
      expect(command.input).toEqual({
        Bucket: "uploads",
        CopySource: "uploads/tmp/photo.jpeg",
        Key: "files/2026/01/31/photo.jpeg",
      });
    });
  });

  describe("upload", () => {
    it("should upload data to a temporary path and return a path-style URL", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const { client, send } = createClientWithSend({
        endpoint: "http://s3.local:9000",
        forcePathStyle: true,
      });
      const service = await createService({
        bucket: "uploads",
        client,
      });
      const body = Readable.from(["hello"]);

      const url = await service.upload(body, {
        "Content-Type": "image/png",
        source: "unit-test",
      });

      expect(url).toMatch(
        /^http:\/\/s3\.local:9000\/uploads\/tmp\/2026\/01\/31\/.+\.png$/,
      );
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Body: body,
        Bucket: "uploads",
        ContentType: "image/png",
        Key: expect.stringMatching(/^tmp\/2026\/01\/31\/.+\.png$/),
        Metadata: {
          "Content-Type": "image/png",
          source: "unit-test",
        },
      });
    });

    it("should use the provided extension and return a virtual-host style URL", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const service = await createService({
        bucket: "uploads",
        client: {
          credentials: {
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
          },
          endpoint: "https://s3.example.com",
          forcePathStyle: false,
          region: "us-east-1",
        },
      });
      const client = (service as unknown as { s3Client: S3Client }).s3Client;
      vi.spyOn(client, "send").mockResolvedValue({} as never);

      const url = await service.upload("hello", {
        "Content-Type": "application/octet-stream",
        extension: "txt",
      });

      expect(url).toMatch(
        /^https:\/\/uploads\.s3\.example\.com\/tmp\/2026\/01\/31\/.+\.txt$/,
      );
    });

    it("should persist uploaded files when requested", async () => {
      const service = await createService({
        bucket: "uploads",
        client: createClient({
          endpoint: "http://s3.local",
          forcePathStyle: true,
        }),
      });
      vi.spyOn(service, "persist").mockResolvedValue(
        "http://s3.local/uploads/files/avatar.bin",
      );

      await expect(
        service.upload(
          Buffer.from("hello"),
          {
            "Content-Type": "application/octet-stream",
          },
          true,
        ),
      ).resolves.toBe("http://s3.local/uploads/files/avatar.bin");
    });

    it("should use bin when the MIME type has no known extension", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const service = await createService({
        bucket: "uploads",
        client: createClient({
          endpoint: "http://s3.local",
          forcePathStyle: true,
        }),
      });

      const url = await service.upload("hello", {
        "Content-Type": "unknown/unknown",
      });

      expect(url).toMatch(/\.bin$/);
    });

    it("should throw when the S3 endpoint is not configured", async () => {
      const service = await createService({
        bucket: "uploads",
        client: createClient(),
      });

      await expect(
        service.upload(Buffer.from("hello"), {
          "Content-Type": "application/octet-stream",
        }),
      ).rejects.toThrow("Endpoint is not configured");
    });
  });

  it("should emit decorator metadata when module options exist at runtime", async () => {
    vi.resetModules();
    vi.doMock("./file-upload-options.interface.js", () => ({
      FileUploadModuleOptions: function FileUploadModuleOptions() {
        return undefined;
      },
    }));

    const isolatedModule = await import("./file-upload.service.js");

    expect(isolatedModule.FileUploadService).toBeDefined();
    vi.doUnmock("./file-upload-options.interface.js");
  });
});

async function createService(options: FileUploadModuleOptions) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      FileUploadService,
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: options,
      },
    ],
  }).compile();

  return moduleRef.get(FileUploadService);
}
