import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Injectable,
  Module,
  type NestInterceptor,
  Post,
  UnauthorizedException,
  UseInterceptors,
  VersioningType,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Observable } from "rxjs";

import {
  MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE,
  StorageModule,
} from "../../src/index.js";

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));
const createPresignedPostMock = vi.mocked(createPresignedPost);
const getSignedUrlMock = vi.mocked(getSignedUrl);

@Injectable()
class HeaderAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (request.headers.authorization === "Bearer valid") {
      return true;
    }
    throw new UnauthorizedException();
  }
}

@Injectable()
class UploadHeaderInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: { handle: () => Observable<unknown> },
  ): Observable<unknown> {
    context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>()
      .setHeader("x-upload-enhanced", "true");
    return next.handle();
  }
}

afterEach(() => {
  vi.resetAllMocks();
});

it("leaves /uploads unmounted by default so custom controllers can own the path", async () => {
  @Controller("uploads")
  class CustomUploadController {
    @Post()
    custom(): { custom: boolean } {
      return { custom: true };
    }
  }

  @Module({ controllers: [CustomUploadController] })
  class CustomUploadModule {}

  const module = await Test.createTestingModule({
    imports: [StorageModule.forRoot({ bucket: "files" }), CustomUploadModule],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const response = await fetch(`${await app.getUrl()}/uploads`, {
      method: "POST",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ custom: true });
  } finally {
    await app.close();
  }
});

it("mounts POST /uploads when enabled, enforces global guards by default, and validates payloads", async () => {
  createPresignedPostMock.mockImplementation((_, { Key }) =>
    Promise.resolve({
      fields: { key: Key, Policy: "policy" },
      url: "https://s3.example.com/files",
    }),
  );
  getSignedUrlMock.mockResolvedValue(
    "https://s3.example.com/files/tenant/tmp/avatar.png?X-Amz-Signature=signed",
  );

  const module = await Test.createTestingModule({
    imports: [
      StorageModule.forRoot({
        bucket: "files",
        rootPath: "tenant",
        upload: {
          enabled: true,
          limits: [{ fileSize: 1024, mimeTypes: ["image/*"] }],
        },
      }),
    ],
    providers: [{ provide: APP_GUARD, useClass: HeaderAuthGuard }],
  }).compile();
  const app = module.createNestApplication();
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.listen(0, "127.0.0.1");
    const endpoint = `${await app.getUrl()}/api/uploads`;

    const unauthenticated = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: [] }),
    });
    expect(unauthenticated.status).toBe(401);

    const invalidBody = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ files: "not-an-array" }),
    });
    expect(invalidBody.status).toBe(400);

    const oversizedBatch = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files: Array.from(
          { length: MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE + 1 },
          () => ({ name: "a.png", fileSize: 10, mimeType: "image/png" }),
        ),
      }),
    });
    expect(oversizedBatch.status).toBe(400);
    expect(createPresignedPostMock).not.toHaveBeenCalled();

    const disallowedFile = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files: [
          { name: "doc.pdf", fileSize: 512, mimeType: "application/pdf" },
        ],
      }),
    });
    expect(disallowedFile.status).toBe(400);

    const validResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files: [{ name: "avatar.png", fileSize: 512, mimeType: "image/png" }],
      }),
    });
    expect(validResponse.status).toBe(201);
    const json = (await validResponse.json()) as {
      uploads: {
        url: string;
        resourceUrl: string;
        fields: { name: string; value: string }[];
      }[];
    };
    expect(json.uploads).toHaveLength(1);
    expect(json.uploads[0]?.url).toBe("https://s3.example.com/files");
    expect(json.uploads[0]?.resourceUrl).toBe(
      "https://s3.example.com/files/tenant/tmp/avatar.png?X-Amz-Signature=signed",
    );
    expect(json.uploads[0]?.fields[0]).toEqual({
      name: "key",
      value: expect.stringMatching(/^tenant\/tmp\/.+\.png$/),
    });
  } finally {
    await app.close();
  }
});

it("supports custom upload path and decorators via forRootAsync", async () => {
  createPresignedPostMock.mockResolvedValueOnce({
    fields: { key: "tmp/test.png" },
    url: "https://s3.example.com/files",
  });
  getSignedUrlMock.mockResolvedValueOnce(
    "https://s3.example.com/files/tmp/test.png?X-Amz-Signature=signed",
  );

  const module = await Test.createTestingModule({
    imports: [
      StorageModule.forRootAsync({
        useFactory: () => ({
          bucket: "files",
          upload: {
            enabled: true,
            path: "/media/temporary-uploads/",
            decorators: [Public(), UseInterceptors(UploadHeaderInterceptor)],
          },
        }),
      }),
    ],
    providers: [{ provide: APP_GUARD, useClass: HeaderAuthGuard }],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const response = await fetch(
      `${await app.getUrl()}/media/temporary-uploads`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: [{ name: "test.png", fileSize: 64, mimeType: "image/png" }],
        }),
      },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("x-upload-enhanced")).toBe("true");
  } finally {
    await app.close();
  }
});

it("rejects invalid upload route options during registration", async () => {
  await expect(
    Test.createTestingModule({
      imports: [
        StorageModule.forRoot({
          bucket: "files",
          upload: { enabled: true, path: "/uploads/:id" },
        }),
      ],
    }).compile(),
  ).rejects.toThrow(
    "Storage upload path must contain only static URL segments",
  );

  await expect(
    Test.createTestingModule({
      imports: [
        StorageModule.forRoot({
          bucket: "files",
          upload: {
            enabled: true,
            decorators: ["invalid" as unknown as ClassDecorator],
          },
        }),
      ],
    }).compile(),
  ).rejects.toThrow(
    "Storage upload decorators must be an array of class decorators",
  );
});
