import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
import { JwtService } from "@nest-boot/jwt";
import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Global,
  Injectable,
  Module,
  type NestInterceptor,
  UnauthorizedException,
  UseInterceptors,
  VersioningType,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Observable } from "rxjs";

import { StorageModule, StorageService } from "../../src/index.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
const getSignedUrlMock = vi.mocked(getSignedUrl);

@Injectable()
class PublicAwareGlobalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException();
  }
}

@Controller("protected")
class ProtectedController {
  @Get()
  check(): { ok: boolean } {
    return { ok: true };
  }
}

@Injectable()
class DownloadHeaderInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: { handle: () => Observable<unknown> },
  ): Observable<unknown> {
    context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>()
      .setHeader("x-download-enhanced", "true");
    return next.handle();
  }
}

const ISOLATED_ENV_KEYS = [
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
];

beforeEach(() => {
  for (const name of ISOLATED_ENV_KEYS) {
    vi.stubEnv(name, "");
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("keeps storage usable and returns 404 when the app has no JwtModule", async () => {
  const module = await Test.createTestingModule({
    imports: [StorageModule.forRoot({ bucket: "files" })],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const response = await fetch(
      `${await app.getUrl()}/downloads/files/file.txt`,
    );
    expect(response.status).toBe(404);
    await expect(
      app
        .get(StorageService)
        .createFileDownloadUrl("files/file.txt", { subject: "user:42" }),
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
    factory: () => StorageModule.forRoot({ bucket: "files" }),
    expectedError: "Storage download links require JwtModule",
  },
  {
    label: "without JwtModule (async)",
    factory: () =>
      StorageModule.forRootAsync({ useFactory: () => ({ bucket: "files" }) }),
    expectedError: "Storage download links require JwtModule",
  },
  {
    label: "when explicitly disabled (sync)",
    factory: () =>
      StorageModule.forRoot({ bucket: "files", download: { enabled: false } }),
    expectedError: "Storage downloads are disabled",
  },
  {
    label: "when explicitly disabled (async)",
    factory: () =>
      StorageModule.forRootAsync({
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
    @Controller("downloads")
    class CustomDownloadController {
      @Get("*key")
      getFile(): { custom: boolean } {
        return { custom: true };
      }
    }

    @Module({ controllers: [CustomDownloadController] })
    class CustomDownloadModule {}

    const module = await Test.createTestingModule({
      imports: [factory(), CustomDownloadModule],
    }).compile();
    const app = module.createNestApplication();
    try {
      await app.listen(0, "127.0.0.1");
      const response = await fetch(
        `${await app.getUrl()}/downloads/files/file.txt`,
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ custom: true });
      await expect(
        app
          .get(StorageService)
          .createFileDownloadUrl("files/file.txt", { subject: "user:42" }),
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
    route: "downloads",
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
  "mounts the $registration download route at $route (excluded: $excluded) with @Public() and VERSION_NEUTRAL by default",
  async ({ registration, path: configuredPath, route, excluded }) => {
    vi.stubEnv("STORAGE_BUCKET", "files");
    getSignedUrlMock.mockResolvedValue(
      "https://files.example.com/image.png?signature=example",
    );
    const prefix = registration === "direct" ? "" : "gateway/api";
    const rootPath = registration === "async" ? "tenant-a" : "";
    const key = "files/2026/11/27/image #? %.png";
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
        ...(registration === "async"
          ? {
              decorators: [
                Public(),
                UseInterceptors(DownloadHeaderInterceptor),
              ],
            }
          : {}),
        resolveContentType: (candidate: string) =>
          candidate.endsWith(".png") ? "image/png" : null,
      },
    };
    const registeredModule = {
      direct: StorageModule,
      sync: StorageModule.forRoot(options),
      async: StorageModule.forRootAsync({ useFactory: () => options }),
    }[registration];
    const module = await Test.createTestingModule({
      imports: [registeredModule, JwtFixtureModule],
      controllers: [ProtectedController],
      providers: [{ provide: APP_GUARD, useClass: PublicAwareGlobalGuard }],
    }).compile();
    const app = module.createNestApplication();
    try {
      const storage = app.get(StorageService);
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
      const baseAppUrl = await app.getUrl();
      const protectedPath = `${prefix ? `/${prefix}` : ""}/v1/protected`;
      expect((await fetch(`${baseAppUrl}${protectedPath}`)).status).toBe(401);

      const link = await storage.createFileDownloadUrl(key, {
        subject: "user:42",
      });
      const effectivePrefix = prefix && !excluded ? `/${prefix}` : "";
      const path = `${effectivePrefix}/${route}/files/2026/11/27/image%20%23%3F%20%25.png`;
      expect(link).toBe(
        `${registration === "direct" ? "" : options.download.baseURL}${path}?token=signed-token`,
      );
      expect(storage.parseFileDownloadUrl(link)).toBe(key);
      expect(storage.parseFileDownloadUrl(`${path}?token=signed-token`)).toBe(
        key,
      );
      if (registration === "direct") {
        expect(
          storage.parseFileDownloadUrl(
            `https://api.example.com${path}?token=signed-token`,
          ),
        ).toBe(key);
      } else {
        expect(
          storage.parseFileDownloadUrl(
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

      const url = new URL(`${path}?token=signed-token`, baseAppUrl);
      const response = await fetch(url, { redirect: "manual" });
      expect(response.status).toBe(302);
      if (registration === "async") {
        expect(response.headers.get("x-download-enhanced")).toBe("true");
      }
      if (registration !== "direct") {
        const defaultRoute = new URL(
          `/${prefix}/downloads/files/file.txt`,
          baseAppUrl,
        );
        expect((await fetch(defaultRoute)).status).toBe(404);
        expect(
          storage.parseFileDownloadUrl(defaultRoute.pathname),
        ).toBeUndefined();
      }
      if (excluded) {
        const prefixedUrl = new URL(
          `/${prefix}/${route}/files/2026/11/27/image%20%23%3F%20%25.png?token=signed-token`,
          baseAppUrl,
        );
        expect((await fetch(prefixedUrl, { redirect: "manual" })).status).toBe(
          404,
        );
      }
      expect(response.headers.get("location")).toBe(
        "https://files.example.com/image.png?signature=example",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");

      const signedCall = getSignedUrlMock.mock.calls[0];
      const command = signedCall?.[1];
      const presignOptions = signedCall?.[2];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command?.input).toEqual({
        Bucket: "files",
        Key: rootPath ? `${rootPath}/${key}` : key,
        ResponseCacheControl: "no-store",
        ...(registration === "direct"
          ? { ResponseContentDisposition: "attachment" }
          : {}),
        ResponseContentType:
          registration === "direct" ? undefined : "image/png",
      });
      const signingTime =
        presignOptions?.signingDate instanceof Date
          ? presignOptions.signingDate.getTime()
          : Number.NaN;
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

      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      await expect(
        storage.createFileDownloadUrl("nested/../private.png", {
          subject: "user:42",
        }),
      ).rejects.toThrow("Invalid storage download key");
      if (registration !== "direct") {
        await expect(
          storage.createFileDownloadUrl("nested/unsupported.txt", {
            subject: "user:42",
          }),
        ).rejects.toThrow("Invalid storage download key");
      }
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  },
);

it("rejects invalid download route options during registration", async () => {
  await expect(
    Test.createTestingModule({
      imports: [
        StorageModule.forRoot({
          bucket: "files",
          download: { path: "/downloads/:id" },
        }),
      ],
    }).compile(),
  ).rejects.toThrow(
    "Storage download path must contain only static URL segments",
  );

  await expect(
    Test.createTestingModule({
      imports: [
        StorageModule.forRoot({
          bucket: "files",
          download: {
            decorators: ["invalid" as unknown as ClassDecorator],
          },
        }),
      ],
    }).compile(),
  ).rejects.toThrow(
    "Storage download decorators must be an array of class decorators",
  );
});
