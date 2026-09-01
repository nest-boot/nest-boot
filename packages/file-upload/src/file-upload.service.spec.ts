import { Readable } from "node:stream";

import { Storage } from "@nest-boot/storage";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition.js";
import { FileUploadService } from "./file-upload.service.js";
import { type FileUploadModuleOptions } from "./file-upload-options.interface.js";

describe("FileUploadService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
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

      expect(url).toMatch(
        /^https:\/\/storage\.local\/tmp\/2026\/01\/31\/.+\.png$/,
      );
      expect(storage.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/^tmp\/2026\/01\/31\/.+\.png$/),
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

    it("persists uploaded files when requested", async () => {
      const storage = createStorage();
      const service = await createService({}, storage.value);
      vi.spyOn(service, "persist").mockResolvedValue(
        "https://storage.local/files/avatar.bin",
      );

      await expect(
        service.upload(
          Buffer.from("hello"),
          {
            "Content-Type": "application/octet-stream",
          },
          true,
        ),
      ).resolves.toBe("https://storage.local/files/avatar.bin");
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
  options: FileUploadModuleOptions,
  storage: Storage,
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      FileUploadService,
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

  return moduleRef.get(FileUploadService);
}
