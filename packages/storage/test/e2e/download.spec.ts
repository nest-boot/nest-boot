import { JwtService } from "@nest-boot/jwt";
import {
  Controller,
  Get,
  Global,
  Module,
  VersioningType,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";

import {
  Storage,
  StorageDownloadService,
  StorageModule,
} from "../../src/index.js";

it("keeps storage usable and returns 404 when the app has no JwtModule", async () => {
  const module = await Test.createTestingModule({
    imports: [StorageModule.register({ bucket: "files" })],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const response = await fetch(`${await app.getUrl()}/files/file.txt`);
    expect(response.status).toBe(404);
    await expect(
      app.get(StorageDownloadService).createUrl("file.txt", "user:42"),
    ).rejects.toThrow("Storage download links require JwtModule");
  } finally {
    await app.close();
  }
});

it.each([
  {
    label: "without JwtModule (direct)",
    factory: () => {
      vi.stubEnv("STORAGE_BUCKET", "files");
      return StorageModule;
    },
    expectedError: "Storage download links require JwtModule",
  },
  {
    label: "without JwtModule (sync)",
    factory: () => StorageModule.register({ bucket: "files" }),
    expectedError: "Storage download links require JwtModule",
  },
  {
    label: "without JwtModule (async)",
    factory: () =>
      StorageModule.registerAsync({ useFactory: () => ({ bucket: "files" }) }),
    expectedError: "Storage download links require JwtModule",
  },
  {
    label: "when explicitly disabled (sync)",
    factory: () =>
      StorageModule.register({ bucket: "files", download: { enabled: false } }),
    expectedError: "Storage downloads are disabled",
  },
  {
    label: "when explicitly disabled (async)",
    factory: () =>
      StorageModule.registerAsync({
        useFactory: () => ({
          bucket: "files",
          download: { enabled: false, baseURL: "unused" },
        }),
      }),
    expectedError: "Storage downloads are disabled",
  },
])(
  "leaves the download path free $label",
  async ({ factory, expectedError }) => {
    @Controller("files")
    class CustomStorageController {
      @Get("*key")
      getFile(): { custom: boolean } {
        return { custom: true };
      }
    }

    @Module({ controllers: [CustomStorageController] })
    class CustomStorageModule {}

    const module = await Test.createTestingModule({
      imports: [factory(), CustomStorageModule],
    }).compile();
    const app = module.createNestApplication();
    try {
      await app.listen(0, "127.0.0.1");
      const response = await fetch(`${await app.getUrl()}/files/file.txt`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ custom: true });
      await expect(
        app.get(StorageDownloadService).createUrl("file.txt", "user:42"),
      ).rejects.toThrow(expectedError);
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  },
);

it.each([
  {
    registration: "direct",
    path: undefined,
    route: "files",
    excluded: false,
  },
  {
    registration: "sync",
    path: "/media/download/",
    route: "media/download",
    excluded: false,
  },
  {
    registration: "async",
    path: "assets/signed",
    route: "assets/signed",
    excluded: true,
  },
] as const)(
  "mounts the $registration download route at $route (excluded: $excluded) and stays version-neutral",
  async ({ registration, path: configuredPath, route, excluded }) => {
    vi.stubEnv("STORAGE_BUCKET", "files");
    const prefix = registration === "direct" ? "" : "gateway/api";
    const rootPath = registration === "async" ? "tenant-a" : "";
    const key = "nested/image #? %.png";
    const exp = Math.floor(Date.now() / 1000) + 75;
    const expectedPayload = {
      bucket: "files",
      ...(rootPath ? { rootPath } : {}),
      key,
    };
    const jwt = {
      sign: vi.fn<JwtService["sign"]>().mockResolvedValue("signed-token"),
      verify: vi
        .fn<JwtService["verify"]>()
        .mockResolvedValue({ ...expectedPayload, exp }),
    };
    const storage = {
      createTemporaryUrl: vi
        .fn<Storage["createTemporaryUrl"]>()
        .mockResolvedValue(
          "https://files.example.com/image.png?signature=example",
        ),
    };

    @Global()
    @Module({
      providers: [{ provide: JwtService, useValue: jwt }],
      exports: [JwtService],
    })
    class JwtFixtureModule {}

    const options = {
      bucket: "files",
      ...(rootPath ? { rootPath } : {}),
      download: {
        baseURL: "https://downloads.example.com",
        path: configuredPath,
        resolveContentType: (key: string) =>
          key.endsWith(".png") ? "image/png" : null,
      },
    };
    const registeredModule = {
      direct: StorageModule,
      sync: StorageModule.register(options),
      async: StorageModule.registerAsync({ useFactory: () => options }),
    }[registration];
    const module = await Test.createTestingModule({
      imports: [registeredModule, JwtFixtureModule],
    })
      .overrideProvider(Storage)
      .useValue(storage)
      .compile();
    const app = module.createNestApplication();
    try {
      const downloads = app.get(StorageDownloadService);
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: "1",
      });
      if (prefix) {
        app.setGlobalPrefix(
          prefix,
          excluded ? { exclude: [`${route}/{*key}`] } : undefined,
        );
      }
      await app.listen(0, "127.0.0.1");
      const link = await downloads.createUrl(key, "user:42");
      const effectivePrefix = prefix && !excluded ? `/${prefix}` : "";
      const path = `${effectivePrefix}/${route}/nested/image%20%23%3F%20%25.png`;
      expect(link).toBe(
        `${registration === "direct" ? "" : options.download.baseURL}${path}?token=signed-token`,
      );
      expect(downloads.keyFromUrl(link)).toBe(key);
      expect(downloads.keyFromUrl(`${path}?token=signed-token`)).toBe(key);
      if (registration === "direct") {
        expect(
          downloads.keyFromUrl(
            `https://api.example.com${path}?token=signed-token`,
          ),
        ).toBe(key);
      } else {
        expect(
          downloads.keyFromUrl(
            `https://other.example.com${path}?token=signed-token`,
          ),
        ).toBeUndefined();
      }
      expect(jwt.sign).toHaveBeenCalledWith(expectedPayload, {
        type: "storage-download+jwt",
        audience: "storage-download",
        subject: "user:42",
        expiresIn: 3600,
      });

      const url = new URL(`${path}?token=signed-token`, await app.getUrl());
      const response = await fetch(url, { redirect: "manual" });
      expect(response.status).toBe(302);
      if (registration !== "direct") {
        const defaultRoute = new URL(
          `/${prefix}/files/file.txt`,
          await app.getUrl(),
        );
        expect((await fetch(defaultRoute)).status).toBe(404);
        expect(downloads.keyFromUrl(defaultRoute.pathname)).toBeUndefined();
      }
      if (excluded) {
        const prefixedUrl = new URL(
          `/${prefix}/${route}/nested/image%20%23%3F%20%25.png?token=signed-token`,
          await app.getUrl(),
        );
        expect((await fetch(prefixedUrl, { redirect: "manual" })).status).toBe(
          404,
        );
      }
      expect(response.headers.get("location")).toBe(
        "https://files.example.com/image.png?signature=example",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      const [[requestedKey, presignOptions]] =
        storage.createTemporaryUrl.mock.calls;
      expect(requestedKey).toBe(key);
      expect(presignOptions).toMatchObject({
        ResponseCacheControl: "no-store",
        ResponseContentType:
          registration === "direct" ? undefined : "image/png",
      });
      const signingTime = presignOptions?.signingDate?.getTime() ?? Number.NaN;
      expect(
        Math.floor(signingTime / 1000) + (presignOptions?.expiresIn ?? 0),
      ).toBe(exp);

      const wrongKey = new URL(url);
      wrongKey.pathname = wrongKey.pathname.replace("image", "other");
      expect((await fetch(wrongKey, { redirect: "manual" })).status).toBe(401);

      jwt.verify.mockResolvedValueOnce({
        ...expectedPayload,
        bucket: "other-bucket",
        exp,
      });
      expect((await fetch(url, { redirect: "manual" })).status).toBe(401);

      jwt.verify.mockResolvedValueOnce({
        ...expectedPayload,
        rootPath: "other-root",
        exp,
      });
      expect((await fetch(url, { redirect: "manual" })).status).toBe(401);

      expect(storage.createTemporaryUrl).toHaveBeenCalledTimes(1);
      await expect(
        downloads.createUrl("nested/../private.png", "user:42"),
      ).rejects.toThrow("Invalid storage download key");
      if (registration !== "direct") {
        await expect(
          downloads.createUrl("nested/unsupported.txt", "user:42"),
        ).rejects.toThrow("Invalid storage download key");
      }
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  },
);

it("rejects dynamic download paths during registration", async () => {
  const module = Test.createTestingModule({
    imports: [
      StorageModule.register({
        bucket: "files",
        download: { path: "/files/:id" },
      }),
    ],
  });
  await expect(module.compile()).rejects.toThrow(
    "Storage download path must contain only static URL segments",
  );
});
