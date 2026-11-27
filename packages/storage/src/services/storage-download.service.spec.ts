import type { JwtService } from "@nest-boot/jwt";
import {
  BadRequestException,
  NotFoundException,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";

import type { StorageModuleOptions } from "../interfaces/storage-module-options.interface.js";
import type { Storage } from "../storage.js";
import { StorageDownloadService } from "./storage-download.service.js";

/**
 * Creates a StorageDownloadService instance with test doubles.
 * @param options - Optional storage, JWT, module, and app configuration overrides.
 * @param options.storage - Partial Storage override.
 * @param options.jwt - Partial JwtService override.
 * @param options.moduleOptions - Storage module configuration.
 * @param options.configureApp - Callback to configure ApplicationConfig.
 * @returns Configured StorageDownloadService under test.
 */
function createService(options?: {
  storage?: Partial<Storage>;
  jwt?: Partial<JwtService>;
  moduleOptions?: StorageModuleOptions;
  configureApp?: (config: ApplicationConfig) => void;
}): StorageDownloadService {
  const config = new ApplicationConfig();
  options?.configureApp?.(config);
  const storage = (options?.storage ?? {
    bucket: "files",
    rootPath: "",
    createTemporaryUrl: vi
      .fn<Storage["createTemporaryUrl"]>()
      .mockResolvedValue("https://s3.example.com/signed"),
  }) as Storage;

  return new StorageDownloadService(
    storage,
    config,
    options?.jwt as JwtService | undefined,
    options?.moduleOptions,
  );
}

describe("StorageDownloadService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates baseURL protocol and expiresIn bounds in constructor", () => {
    expect(() =>
      createService({
        moduleOptions: {
          bucket: "files",
          download: { baseURL: "ftp://files.example.com" },
        },
      }),
    ).toThrow("Storage download baseURL must use HTTP or HTTPS");

    expect(() =>
      createService({
        moduleOptions: { bucket: "files", download: { expiresIn: 0 } },
      }),
    ).toThrow("Storage download expiry must be between 1 and 604800 seconds");

    expect(() =>
      createService({
        moduleOptions: { bucket: "files", download: { expiresIn: 604_801 } },
      }),
    ).toThrow("Storage download expiry must be between 1 and 604800 seconds");
  });

  it("requires a configured bucket before signing links", async () => {
    vi.stubEnv("STORAGE_BUCKET", "");
    const service = createService({
      storage: {},
      jwt: { sign: vi.fn() },
    });

    await expect(service.createUrl("file.txt", "user:1")).rejects.toThrow(
      "Storage bucket is required",
    );
  });

  it("rejects invalid or disabled URLs in keyFromUrl", () => {
    const disabled = createService({
      moduleOptions: { bucket: "files", download: { enabled: false } },
    });
    expect(disabled.keyFromUrl("/files/a.txt")).toBeUndefined();

    const service = createService();
    expect(
      service.keyFromUrl("//evil.example.com/files/a.txt"),
    ).toBeUndefined();
    expect(
      service.keyFromUrl("ftp://files.example.com/files/a.txt"),
    ).toBeUndefined();
    expect(service.keyFromUrl("not a valid url")).toBeUndefined();
    expect(service.keyFromUrl("/files/%E0%A4%A")).toBeUndefined();
    expect(service.keyFromUrl("/files/a%5Cb.txt")).toBeUndefined();
  });

  it("honors GET and ALL global-prefix exclusions while ignoring other methods", () => {
    const service = createService({
      configureApp: (config) => {
        config.setGlobalPrefix("api");
        config.setGlobalPrefixOptions({
          exclude: [
            {
              path: "/files/*key",
              pathRegex: /^\/files\/.+$/,
              requestMethod: RequestMethod.POST,
            },
            {
              path: "/files/*key",
              pathRegex: /^\/files\/.+$/,
              requestMethod: RequestMethod.GET,
            },
          ],
        });
      },
    });

    expect(service.keyFromUrl("/files/report.pdf")).toBe("report.pdf");
    expect(service.keyFromUrl("/api/files/report.pdf")).toBeUndefined();
  });

  it("rejects disabled, malformed, expired, and disallowed download requests", async () => {
    const disabled = createService({
      moduleOptions: { bucket: "files", download: { enabled: false } },
    });
    await expect(disabled.downloadUrl("a.png", "token")).rejects.toThrow(
      NotFoundException,
    );

    vi.stubEnv("STORAGE_BUCKET", "");
    const noBucket = createService({
      storage: {},
      jwt: { verify: vi.fn() },
    });
    await expect(noBucket.downloadUrl("a.png", "token")).rejects.toThrow(
      UnauthorizedException,
    );

    const verify = vi.fn<JwtService["verify"]>();
    const service = createService({
      jwt: { verify },
      moduleOptions: {
        bucket: "files",
        download: {
          resolveContentType: (key) =>
            key.endsWith(".png") ? "image/png" : null,
        },
      },
    });

    await expect(service.downloadUrl("a.png", undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.downloadUrl("a\\b.png", "token")).rejects.toThrow(
      UnauthorizedException,
    );

    verify.mockResolvedValueOnce({ bucket: "files", key: "a.png" });
    await expect(service.downloadUrl("a.png", "token")).rejects.toThrow(
      UnauthorizedException,
    );

    verify.mockResolvedValueOnce({
      bucket: "files",
      key: "a.png",
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    await expect(service.downloadUrl("a.png", "token")).rejects.toThrow(
      UnauthorizedException,
    );

    verify.mockResolvedValueOnce({
      bucket: "files",
      key: "blocked.txt",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    await expect(service.downloadUrl("blocked.txt", "token")).rejects.toThrow(
      UnauthorizedException,
    );

    await expect(
      createService({
        jwt: { sign: vi.fn() },
      }).createUrl("", "user:1"),
    ).rejects.toThrow(BadRequestException);
  });
});
