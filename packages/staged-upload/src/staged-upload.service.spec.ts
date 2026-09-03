import { Readable } from "node:stream";

import { Storage } from "@nest-boot/storage";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MODULE_OPTIONS_TOKEN } from "./staged-upload.module-definition.js";
import { StagedUploadService } from "./staged-upload.service.js";
import { type StagedUploadModuleOptions } from "./staged-upload-options.interface.js";

describe("StagedUploadService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("configuration", () => {
    it("rejects empty or ambiguous storage paths", async () => {
      await expect(
        createService({ temporaryPath: "/" }, createStorage().value),
      ).rejects.toThrow(
        "temporaryPath must contain valid storage path segments",
      );
      await expect(
        createService(
          { permanentPath: "/accepted/../files" },
          createStorage().value,
        ),
      ).rejects.toThrow(
        "permanentPath must contain valid storage path segments",
      );
      await expect(
        createService(
          { temporaryPath: "/staging\\pending" },
          createStorage().value,
        ),
      ).rejects.toThrow(
        "temporaryPath must contain valid storage path segments",
      );
    });
  });

  describe("create", () => {
    it("creates constrained uploads and rewrites a custom public URL", async () => {
      const storage = createStorage();
      const service = await createService(
        {
          expires: 120,
          limits: [
            {
              fileSize: 1024,
              mimeTypes: ["image/*"],
            },
          ],
          url: "https://cdn.example.com/static",
        },
        storage.value,
      );

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
            { name: "key", value: "tmp/generated.jpeg" },
            { name: "Policy", value: "policy" },
            { name: "X-Amz-Signature", value: "signature" },
          ],
          url: "https://cdn.example.com/static/tmp/generated.jpeg?uploads=1",
        },
      ]);

      expect(storage.createTemporaryUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^tmp\/.+\.jpeg$/),
        {
          conditions: [
            ["content-length-range", 1, 1024],
            ["eq", "$success_action_status", "201"],
            ["eq", "$Content-Type", "image/jpeg"],
          ],
          expiresIn: 120,
          fields: {
            "Content-Type": "image/jpeg",
            success_action_status: "201",
          },
        },
      );
    });

    it("uses the Storage URL and default expiration without limits", async () => {
      const storage = createStorage();
      const service = await createService({}, storage.value);

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
            { name: "key", value: "tmp/generated.jpeg" },
            { name: "Policy", value: "policy" },
            { name: "X-Amz-Signature", value: "signature" },
          ],
          url: "https://bucket.s3.local/tmp/generated.jpeg?uploads=1",
        },
      ]);

      expect(storage.createTemporaryUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^tmp\/.+$/),
        expect.objectContaining({ expiresIn: 3600 }),
      );
    });

    it("creates uploads below the configured temporary path", async () => {
      const storage = createStorage();
      const service = await createService(
        { temporaryPath: "/staging/pending/" },
        storage.value,
      );

      await service.create([
        {
          fileSize: 512,
          mimeType: "image/jpeg",
          name: "avatar.jpeg",
        },
      ]);

      expect(storage.createTemporaryUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^staging\/pending\/.+\.jpeg$/),
        expect.any(Object),
      );
    });

    it("rejects uploads that do not match configured limits", async () => {
      const storage = createStorage();
      const service = await createService(
        {
          limits: [
            {
              fileSize: 100,
              mimeTypes: ["image/png"],
            },
          ],
        },
        storage.value,
      );

      await expect(
        service.create([
          {
            fileSize: 101,
            mimeType: "image/jpeg",
            name: "avatar.jpeg",
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.createTemporaryUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe("persist", () => {
    it("copies a temporary file through Storage", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.persist("http://s3.local:9000/uploads/tmp/photo.jpeg"),
      ).resolves.toBe("https://storage.local/files/2026/01/31/photo.jpeg");

      expect(storage.copyFile).toHaveBeenCalledWith(
        "tmp/photo.jpeg",
        "files/2026/01/31/photo.jpeg",
      );
      expect(storage.getUrl).toHaveBeenCalledWith(
        "files/2026/01/31/photo.jpeg",
      );
    });

    it("accepts a root-relative S3 upload Location", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.persist("/uploads/tenant/tmp/photo.jpeg"),
      ).resolves.toBe("https://storage.local/files/2026/01/31/photo.jpeg");

      expect(storage.copyFile).toHaveBeenCalledWith(
        "tmp/photo.jpeg",
        "files/2026/01/31/photo.jpeg",
      );
    });

    it("decodes the temporary key after the final tmp path segment", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.persist(
          "https://storage.local/uploads/tmp/tenant/tmp/photo%20one.jpeg",
        ),
      ).resolves.toBe("https://storage.local/files/2026/01/31/photo one.jpeg");

      expect(storage.copyFile).toHaveBeenCalledWith(
        "tmp/photo one.jpeg",
        "files/2026/01/31/photo one.jpeg",
      );
    });

    it("uses configured multi-segment temporary and permanent paths", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService(
        {
          permanentPath: "/accepted/files/",
          temporaryPath: "/staging/pending/",
        },
        storage.value,
      );

      await expect(
        service.persist(
          "https://storage.local/staging/pending/root/staging/pending/photo%20one.jpeg",
        ),
      ).resolves.toBe(
        "https://storage.local/accepted/files/2026/01/31/photo one.jpeg",
      );

      expect(storage.copyFile).toHaveBeenCalledWith(
        "staging/pending/photo one.jpeg",
        "accepted/files/2026/01/31/photo one.jpeg",
      );
    });

    it("rejects URLs without a temporary upload path", async () => {
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.persist("https://storage.local/files/photo.jpeg"),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.persist("not a URL")).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(storage.copyFile).not.toHaveBeenCalled();
    });
  });

  describe("upload", () => {
    it("writes data to a temporary path through Storage", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);
      const body = Readable.from(["hello"]);

      const url = await service.upload(body, {
        "Content-Type": "image/png",
        source: "unit-test",
      });

      expect(url).toMatch(/^https:\/\/storage\.local\/tmp\/.+\.png$/);
      expect(storage.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/^tmp\/[^/]+\.png$/),
        body,
        {
          ContentType: "image/png",
          Metadata: {
            "Content-Type": "image/png",
            source: "unit-test",
          },
        },
      );
    });

    it("uses the provided extension", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);

      const url = await service.upload("hello", {
        "Content-Type": "application/octet-stream",
        extension: "txt",
      });

      expect(url).toMatch(/\.txt$/);
    });

    it("rejects extensions that change the storage path", async () => {
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.upload("hello", {
          "Content-Type": "application/octet-stream",
          extension: "nested/file",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.upload("hello", {
          "Content-Type": "application/octet-stream",
          extension: "nested\\file",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.writeFile).not.toHaveBeenCalled();
    });

    it("persists the original temporary path without duplicating its date", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      storage.getUrl.mockImplementation((path: string) =>
        Promise.resolve(
          `https://storage.local/${path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        ),
      );
      const service = await createService({}, storage.value);

      const url = await service.upload(
        Buffer.from("hello"),
        {
          "Content-Type": "application/octet-stream",
          extension: "my file",
        },
        true,
      );
      const temporaryPath = String(storage.writeFile.mock.calls[0]?.[0]);
      const filename = temporaryPath.slice("tmp/".length);

      expect(temporaryPath).toMatch(/^tmp\/[^/]+\.my file$/);
      expect(storage.copyFile).toHaveBeenCalledWith(
        temporaryPath,
        `files/2026/01/31/${filename}`,
      );
      expect(url).toBe(
        `https://storage.local/files/2026/01/31/${encodeURIComponent(filename)}`,
      );
      expect(storage.getUrl).toHaveBeenCalledTimes(1);
    });

    it("persists uploaded files when requested", async () => {
      const storage = createStorage();
      const service = await createService({}, storage.value);

      await expect(
        service.upload(
          Buffer.from("hello"),
          {
            "Content-Type": "application/octet-stream",
          },
          true,
        ),
      ).resolves.toMatch(/^https:\/\/storage\.local\/files\//);

      expect(storage.copyFile).toHaveBeenCalledOnce();
    });

    it("uses configured paths for direct persistent uploads", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService(
        {
          permanentPath: "/accepted/files",
          temporaryPath: "/staging/pending",
        },
        storage.value,
      );

      await service.upload(
        Buffer.from("hello"),
        { "Content-Type": "application/octet-stream" },
        true,
      );

      const temporaryPath = String(storage.writeFile.mock.calls[0]?.[0]);
      const filename = temporaryPath.slice("staging/pending/".length);
      expect(temporaryPath).toMatch(/^staging\/pending\/[^/]+\.bin$/);
      expect(storage.copyFile).toHaveBeenCalledWith(
        temporaryPath,
        `accepted/files/2026/01/31/${filename}`,
      );
    });

    it("uses bin when the MIME type has no known extension", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-31T12:00:00.000Z"));
      const storage = createStorage();
      const service = await createService({}, storage.value);

      const url = await service.upload("hello", {
        "Content-Type": "unknown/unknown",
      });

      expect(url).toMatch(/\.bin$/);
    });

    it("propagates Storage URL failures", async () => {
      const storage = createStorage();
      storage.getUrl.mockRejectedValue(new Error("Endpoint is not configured"));
      const service = await createService({}, storage.value);

      await expect(
        service.upload(Buffer.from("hello"), {
          "Content-Type": "application/octet-stream",
        }),
      ).rejects.toThrow("Endpoint is not configured");
    });
  });

  it("emits decorator metadata when module options exist at runtime", async () => {
    vi.resetModules();
    vi.doMock("./staged-upload-options.interface.js", () => ({
      StagedUploadModuleOptions: function StagedUploadModuleOptions() {
        return undefined;
      },
    }));

    const isolatedModule = await import("./staged-upload.service.js");

    expect(isolatedModule.StagedUploadService).toBeDefined();
    vi.doUnmock("./staged-upload-options.interface.js");
  });
});

function createStorage() {
  const copyFile = vi.fn().mockResolvedValue(undefined);
  const createTemporaryUploadUrl = vi.fn().mockResolvedValue({
    fields: {
      key: "tmp/generated.jpeg",
      Policy: "policy",
      "X-Amz-Signature": "signature",
    },
    url: "https://bucket.s3.local/tmp/generated.jpeg?uploads=1",
  });
  const getUrl = vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(`https://storage.local/${path}`),
    );
  const writeFile = vi.fn().mockResolvedValue(undefined);

  return {
    copyFile,
    createTemporaryUploadUrl,
    getUrl,
    value: {
      copyFile,
      createTemporaryUploadUrl,
      getUrl,
      writeFile,
    } as unknown as Storage,
    writeFile,
  };
}

async function createService(
  options: StagedUploadModuleOptions,
  storage: Storage,
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StagedUploadService,
      {
        provide: Storage,
        useValue: storage,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: options,
      },
    ],
  }).compile();

  return moduleRef.get(StagedUploadService);
}
