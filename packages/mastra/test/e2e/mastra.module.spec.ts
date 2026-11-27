import { request as httpRequest } from "node:http";

import { Mastra } from "@mastra/core/mastra";
import { CAN_METADATA } from "@nest-boot/auth";
import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Inject,
  Injectable,
  Module,
  type NestInterceptor,
  UseGuards,
  UseInterceptors,
  VersioningType,
} from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { tap } from "rxjs";
import { z } from "zod";

import {
  BaseAgent,
  BaseStep,
  BaseWorkflow,
  MastraController,
  MastraModule,
  type MastraModuleOptions,
} from "../../src/index.js";

@Injectable()
class WriterAgent extends BaseAgent {
  constructor() {
    super({
      name: "Writer Agent",
      instructions: "Help draft articles.",
      model: "openai/gpt-4o-mini",
    });
  }
}

@Injectable()
class EchoStep extends BaseStep({
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
}) {
  execute({ inputData }: { inputData: { text: string } }) {
    return Promise.resolve({ text: inputData.text });
  }
}

@Injectable()
class EchoWorkflow extends BaseWorkflow({
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
}) {
  constructor(echoStep: EchoStep) {
    super();
    this.then(echoStep).commit();
  }
}

@Module({
  providers: [WriterAgent, EchoStep, EchoWorkflow],
  exports: [WriterAgent, EchoStep, EchoWorkflow],
})
class SampleFeatureModule {}

const ORIGINAL_ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  MASTRA_DATABASE_URL: process.env.MASTRA_DATABASE_URL,
  MASTRA_CLICKHOUSE_URL: process.env.MASTRA_CLICKHOUSE_URL,
};

describe("MastraModule HTTP & Studio (e2e)", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.MASTRA_DATABASE_URL;
    delete process.env.MASTRA_CLICKHOUSE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_ENV.DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_ENV.DATABASE_URL;
    }
    if (ORIGINAL_ENV.MASTRA_DATABASE_URL === undefined) {
      delete process.env.MASTRA_DATABASE_URL;
    } else {
      process.env.MASTRA_DATABASE_URL = ORIGINAL_ENV.MASTRA_DATABASE_URL;
    }
    if (ORIGINAL_ENV.MASTRA_CLICKHOUSE_URL === undefined) {
      delete process.env.MASTRA_CLICKHOUSE_URL;
    } else {
      process.env.MASTRA_CLICKHOUSE_URL = ORIGINAL_ENV.MASTRA_CLICKHOUSE_URL;
    }
  });

  it.each([
    { port: 4111 },
    { host: "0.0.0.0" },
    { auth: { enabled: false } },
    { customRouteAuthConfig: new Map() },
    { apiRoutes: [] },
    { middleware: [] },
    { cors: {} },
    { apiPrefix: "/api" },
  ])(
    "rejects unsupported standalone server keys in sync and async modules: %j",
    async (server) => {
      const options = { server } as unknown as MastraModuleOptions;
      for (const mastraModule of [
        MastraModule.forRoot(options),
        MastraModule.forRootAsync({
          useFactory: () => Promise.resolve(options),
        }),
      ]) {
        await expect(
          Test.createTestingModule({ imports: [mastraModule] }).compile(),
        ).rejects.toThrow(/MastraModule does not support server\..*NestJS/);
      }
    },
  );

  it.each([true, false])(
    "serves Studio with custom and global prefixes when server is %s",
    async (serverEnabled) => {
      const prefix = "/api/custom-mastra";
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.forRootAsync({
            useFactory: () => ({
              server: { enabled: serverEnabled, prefix },
              studio: true,
            }),
          }),
        ],
      }).compile();
      const app = moduleRef.createNestApplication();
      app.setGlobalPrefix("v2/nested/");
      await app.listen(0);
      try {
        const url = await app.getUrl();
        const studioRes = await fetch(`${url}/v2/nested${prefix}/studio`);
        expect(studioRes.status).toBe(200);
        const html = await studioRes.text();
        expect(html).toContain(`<base href="/v2/nested${prefix}/studio/" />`);
        expect(html).toContain(
          `window.MASTRA_API_PREFIX = '/v2/nested${prefix}';`,
        );
        const apiRes = await fetch(`${url}/v2/nested${prefix}/agents`);
        expect(apiRes.status).toBe(serverEnabled ? 200 : 404);
      } finally {
        await app.close();
      }
    },
  );

  it("runs in headless mode by default when imported directly, via forRoot(), or via forRootAsync()", async () => {
    @Controller("api/mastra")
    class HostMastraCustomController {
      @Get("custom")
      custom() {
        return { hostOwned: true };
      }
    }

    for (const mastraModule of [
      MastraModule,
      MastraModule.forRoot(),
      MastraModule.forRootAsync({ useFactory: () => ({}) }),
    ]) {
      const moduleRef = await Test.createTestingModule({
        imports: [mastraModule, SampleFeatureModule],
        controllers: [HostMastraCustomController],
      }).compile();
      const app = moduleRef.createNestApplication();
      app.useGlobalGuards({
        canActivate: (context) =>
          context.getClass() === HostMastraCustomController,
      });
      await app.listen(0);
      try {
        expect(() =>
          moduleRef.get(MastraController, { strict: false }),
        ).toThrow();
        expect(moduleRef.get(Mastra).getAgent("writer-agent")).toBe(
          moduleRef.get(WriterAgent),
        );
        const url = await app.getUrl();
        expect((await fetch(`${url}/api/mastra/agents`)).status).toBe(404);
        expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(404);
        const customRes = await fetch(`${url}/api/mastra/custom`);
        expect(customRes.status).toBe(200);
        expect(await customRes.json()).toEqual({ hostOwned: true });
      } finally {
        await app.close();
      }
    }
  });

  it("enforces NestJS guards on API requests while serving the public Studio shell when server is enabled", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot({ server: true })],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalGuards({ canActivate: () => false });
    await app.listen(0);
    try {
      const url = await app.getUrl();
      expect((await fetch(`${url}/api/mastra/agents`)).status).toBe(403);
      expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("exposes Mastra HTTP API under /api/mastra and Studio under /api/mastra/studio without shadowing other controllers", async () => {
    @Controller("api/demo")
    class DemoController {
      @Get("ping")
      ping() {
        return { ok: true };
      }
    }

    @Module({
      controllers: [DemoController],
    })
    class DemoFeatureModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({ server: true }),
        DemoFeatureModule,
        SampleFeatureModule,
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    try {
      const baseUrl = await app.getUrl();

      const demoRes = await fetch(`${baseUrl}/api/demo/ping`);
      expect(demoRes.status).toBe(200);
      expect(await demoRes.json()).toEqual({ ok: true });

      const missingRes = await fetch(`${baseUrl}/does-not-exist`);
      expect(missingRes.status).toBe(404);

      const unknownMastraRes = await fetch(
        `${baseUrl}/api/mastra/does-not-exist`,
      );
      expect(unknownMastraRes.status).toBe(404);

      const agentsRes = await fetch(`${baseUrl}/api/mastra/agents`);
      expect(agentsRes.status).toBe(200);
      const agentsBody = (await agentsRes.json()) as Record<string, unknown>;
      expect(Object.keys(agentsBody)).toEqual(
        expect.arrayContaining(["writer-agent"]),
      );

      const workflowsRes = await fetch(`${baseUrl}/api/mastra/workflows`);
      expect(workflowsRes.status).toBe(200);
      const workflowsBody = (await workflowsRes.json()) as Record<
        string,
        unknown
      >;
      expect(Object.keys(workflowsBody)).toEqual(
        expect.arrayContaining(["echo-workflow"]),
      );

      const studioRes = await fetch(`${baseUrl}/api/mastra/studio`, {
        redirect: "manual",
      });
      expect(studioRes.status).toBe(200);
      expect(studioRes.headers.get("content-type")).toContain("text/html");
      const studioHtml = await studioRes.text();
      expect(studioHtml).toContain('<base href="/api/mastra/studio/" />');
      expect(studioHtml).toContain("window.MASTRA_API_PREFIX = '/api/mastra';");
      expect(studioHtml).toContain(
        "window.MASTRA_STUDIO_BASE_PATH = '/api/mastra/studio';",
      );
      expect(studioHtml).toContain(
        "window.MASTRA_SERVER_HOST = window.location.hostname;",
      );
      expect(studioHtml).toContain(
        "window.MASTRA_SERVER_PORT = (window.location.port || (window.location.protocol === 'https:' ? '443' : '80'));",
      );
      expect(studioHtml).toContain(
        "window.MASTRA_SERVER_PROTOCOL = window.location.protocol.slice(0, -1);",
      );
      expect(studioHtml).toContain("window.MASTRA_AUTO_DETECT_URL = 'true';");
      expect(studioHtml).not.toContain("%%MASTRA_");

      const studioIndexHtmlRes = await fetch(
        `${baseUrl}/api/mastra/studio/index.html`,
      );
      expect(studioIndexHtmlRes.status).toBe(200);
      expect(studioIndexHtmlRes.headers.get("content-type")).toContain(
        "text/html",
      );
      const studioIndexHtml = await studioIndexHtmlRes.text();
      expect(studioIndexHtml).toContain(
        "window.MASTRA_API_PREFIX = '/api/mastra';",
      );
      expect(studioIndexHtml).not.toContain("%%MASTRA_");

      const studioSubRouteRes = await fetch(
        `${baseUrl}/api/mastra/studio/agents/writer-agent`,
      );
      expect(studioSubRouteRes.status).toBe(200);
      expect(studioSubRouteRes.headers.get("content-type")).toContain(
        "text/html",
      );

      const studioFaviconRes = await fetch(
        `${baseUrl}/api/mastra/studio/mastra-dark-tile.svg`,
      );
      expect(studioFaviconRes.status).toBe(200);
      expect(studioFaviconRes.headers.get("content-type")).toContain(
        "image/svg+xml",
      );

      const missingAssetRes = await fetch(
        `${baseUrl}/api/mastra/studio/assets/does-not-exist.js`,
      );
      expect(missingAssetRes.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("supports configuring custom prefix, disabling studio, and disabling server statically or asynchronously", async () => {
    const customPrefixRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRootAsync({
          useFactory: () => ({
            server: {
              prefix: "/api/custom-mastra",
            },
          }),
        }),
        SampleFeatureModule,
      ],
    }).compile();

    const customPrefixApp = customPrefixRef.createNestApplication();
    await customPrefixApp.init();
    await customPrefixApp.listen(0);

    try {
      const baseUrl = await customPrefixApp.getUrl();

      const customAgentsRes = await fetch(
        `${baseUrl}/api/custom-mastra/agents`,
      );
      expect(customAgentsRes.status).toBe(200);

      const customStudioRes = await fetch(
        `${baseUrl}/api/custom-mastra/studio`,
      );
      expect(customStudioRes.status).toBe(200);
      const customStudioHtml = await customStudioRes.text();
      expect(customStudioHtml).toContain(
        '<base href="/api/custom-mastra/studio/" />',
      );
      expect(customStudioHtml).toContain(
        "window.MASTRA_API_PREFIX = '/api/custom-mastra';",
      );

      expect((await fetch(`${baseUrl}/api/mastra/agents`)).status).toBe(404);
    } finally {
      await customPrefixApp.close();
    }

    const disabledStudioRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          server: true,
          studio: false,
        }),
        SampleFeatureModule,
      ],
    }).compile();

    const disabledStudioApp = disabledStudioRef.createNestApplication();
    await disabledStudioApp.init();
    await disabledStudioApp.listen(0);

    try {
      const url = await disabledStudioApp.getUrl();
      expect((await fetch(`${url}/api/mastra/agents`)).status).toBe(200);
      expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(404);
    } finally {
      await disabledStudioApp.close();
    }

    const disabledApiRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          server: false,
        }),
        SampleFeatureModule,
      ],
    }).compile();

    const disabledApiApp = disabledApiRef.createNestApplication();
    await disabledApiApp.init();
    await disabledApiApp.listen(0);

    try {
      expect(() =>
        disabledApiRef.get(MastraController, { strict: false }),
      ).toThrow();
      expect(disabledApiRef.get(Mastra).getAgent("writer-agent")).toBe(
        disabledApiRef.get(WriterAgent),
      );

      const url = await disabledApiApp.getUrl();
      expect((await fetch(`${url}/api/mastra/agents`)).status).toBe(404);
      expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(404);
    } finally {
      await disabledApiApp.close();
    }

    @Controller("api/demo")
    class AsyncDisabledDemoController {
      @Get("ping")
      ping() {
        return { ok: true };
      }
    }

    @Module({
      controllers: [AsyncDisabledDemoController],
    })
    class AsyncDisabledDemoModule {}

    const asyncDisabledApiRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRootAsync({
          useFactory: () => ({
            server: false,
          }),
        }),
        AsyncDisabledDemoModule,
        SampleFeatureModule,
      ],
    }).compile();

    const asyncDisabledApiApp = asyncDisabledApiRef.createNestApplication();
    await asyncDisabledApiApp.init();
    await asyncDisabledApiApp.listen(0);

    try {
      expect(asyncDisabledApiRef.get(Mastra).getAgent("writer-agent")).toBe(
        asyncDisabledApiRef.get(WriterAgent),
      );

      const url = await asyncDisabledApiApp.getUrl();
      const demoRes = await fetch(`${url}/api/demo/ping`);
      expect(demoRes.status).toBe(200);
      expect(await demoRes.json()).toEqual({ ok: true });
      expect((await fetch(`${url}/api/mastra/agents`)).status).toBe(404);
      expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(404);
    } finally {
      await asyncDisabledApiApp.close();
    }

    const globalPrefixRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot({ server: true }), SampleFeatureModule],
    }).compile();

    const globalPrefixApp = globalPrefixRef.createNestApplication();
    globalPrefixApp.setGlobalPrefix("v1");
    await globalPrefixApp.init();
    await globalPrefixApp.listen(0);

    try {
      const url = await globalPrefixApp.getUrl();
      const prefixedAgentsRes = await fetch(`${url}/v1/api/mastra/agents`);
      expect(prefixedAgentsRes.status).toBe(200);
      const prefixedAgentsBody = (await prefixedAgentsRes.json()) as Record<
        string,
        unknown
      >;
      expect(Object.keys(prefixedAgentsBody)).toEqual(
        expect.arrayContaining(["writer-agent"]),
      );

      for (const suffix of ["", "/index.html", "/agents/writer-agent"]) {
        const studioRes = await fetch(`${url}/v1/api/mastra/studio${suffix}`);
        expect(studioRes.status).toBe(200);
        const html = await studioRes.text();
        expect(html).toContain('<base href="/v1/api/mastra/studio/" />');
        expect(html).toContain("window.MASTRA_API_PREFIX = '/v1/api/mastra';");
        expect(html).toContain(
          "window.MASTRA_STUDIO_BASE_PATH = '/v1/api/mastra/studio';",
        );
      }
      const assetRes = await fetch(
        `${url}/v1/api/mastra/studio/mastra-dark-tile.svg`,
      );
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get("content-type")).toContain("image/svg+xml");
      expect((await fetch(`${url}/api/mastra/studio`)).status).toBe(404);
    } finally {
      await globalPrefixApp.close();
    }

    @Controller("demo")
    class ExcludedPrefixDemoController {
      @Get("ping")
      ping() {
        return { ok: true };
      }
    }

    @Module({
      controllers: [ExcludedPrefixDemoController],
    })
    class ExcludedPrefixDemoModule {}

    const excludedPrefixRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({ server: true }),
        ExcludedPrefixDemoModule,
        SampleFeatureModule,
      ],
    }).compile();

    const excludedPrefixApp = excludedPrefixRef.createNestApplication();
    excludedPrefixApp.setGlobalPrefix("v1", {
      exclude: ["/api/mastra", "/api/mastra/{*path}"],
    });
    await excludedPrefixApp.init();
    await excludedPrefixApp.listen(0);

    try {
      const url = await excludedPrefixApp.getUrl();

      const demoRes = await fetch(`${url}/v1/demo/ping`);
      expect(demoRes.status).toBe(200);
      expect(await demoRes.json()).toEqual({ ok: true });

      const agentsRes = await fetch(`${url}/api/mastra/agents`);
      expect(agentsRes.status).toBe(200);
      const agentsBody = (await agentsRes.json()) as Record<string, unknown>;
      expect(Object.keys(agentsBody)).toEqual(
        expect.arrayContaining(["writer-agent"]),
      );

      const studioRes = await fetch(`${url}/api/mastra/studio`);
      expect(studioRes.status).toBe(200);
      const studioHtml = await studioRes.text();
      expect(studioHtml).toContain('<base href="/api/mastra/studio/" />');
      expect(studioHtml).toContain("window.MASTRA_API_PREFIX = '/api/mastra';");
      expect(studioHtml).toContain(
        "window.MASTRA_STUDIO_BASE_PATH = '/api/mastra/studio';",
      );
      expect((await fetch(`${url}/v1/api/mastra/studio`)).status).toBe(404);
    } finally {
      await excludedPrefixApp.close();
    }
  });

  it.each([false, true])(
    "supports custom server.decorators with DI enhancers and stays VERSION_NEUTRAL (async: %s)",
    async (asyncRegistration) => {
      const API_TOKEN = Symbol("API_TOKEN");

      @Injectable()
      class MastraTokenGuard implements CanActivate {
        constructor(@Inject(API_TOKEN) private readonly token: string) {}

        canActivate(context: ExecutionContext): boolean {
          const req = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string | undefined> }>();
          return req.headers["x-mastra-token"] === this.token;
        }
      }

      @Injectable()
      class MastraHeaderInterceptor implements NestInterceptor {
        intercept(
          context: ExecutionContext,
          next: Parameters<NestInterceptor["intercept"]>[1],
        ) {
          const res = context.switchToHttp().getResponse<{
            setHeader: (name: string, value: string) => void;
          }>();
          return next.handle().pipe(
            tap(() => {
              res.setHeader("x-mastra-intercepted", "1");
            }),
          );
        }
      }

      @Module({
        providers: [{ provide: API_TOKEN, useValue: "mastra-secret" }],
        exports: [API_TOKEN],
      })
      class MastraSecurityModule {}

      const decorators = [
        UseGuards(MastraTokenGuard),
        UseInterceptors(MastraHeaderInterceptor),
      ];
      const mastraModule = asyncRegistration
        ? MastraModule.forRootAsync({
            imports: [MastraSecurityModule],
            useFactory: () =>
              Promise.resolve({
                server: {
                  prefix: "/api/secured-mastra",
                  decorators,
                },
              }),
          })
        : {
            ...MastraModule.forRoot({
              server: {
                prefix: "/api/secured-mastra",
                decorators,
              },
            }),
            imports: [
              ...(MastraModule.forRoot().imports ?? []),
              MastraSecurityModule,
            ],
          };

      const moduleRef = await Test.createTestingModule({
        imports: [mastraModule, SampleFeatureModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: "1",
      });
      await app.listen(0);

      try {
        const modulesContainer = moduleRef.get(ModulesContainer);
        const controllerWrapper = [...modulesContainer.values()]
          .flatMap((mod) => [...mod.controllers.values()])
          .find((wrapper) => wrapper.instance instanceof MastraController);
        expect(controllerWrapper?.metatype).toBeDefined();
        expect(
          Reflect.getMetadata(
            CAN_METADATA,
            controllerWrapper?.metatype as object,
          ),
        ).toBeUndefined();

        const url = await app.getUrl();
        expect((await fetch(`${url}/api/secured-mastra/agents`)).status).toBe(
          403,
        );
        expect(
          (await fetch(`${url}/v1/api/secured-mastra/agents`)).status,
        ).toBe(404);

        const okRes = await fetch(`${url}/api/secured-mastra/agents`, {
          headers: { "x-mastra-token": "mastra-secret" },
        });
        expect(okRes.status).toBe(200);
        expect(okRes.headers.get("x-mastra-intercepted")).toBe("1");
      } finally {
        await app.close();
      }
    },
  );

  it("preserves server.prefix and VERSION_NEUTRAL when server.decorators includes @Controller({ host })", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          server: {
            prefix: "/api/host-mastra",
            decorators: [Controller({ host: "mastra.example.test" })],
          },
        }),
      ],
      providers: [WriterAgent],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    await app.listen(0, "127.0.0.1");

    try {
      const url = await app.getUrl();
      expect((await fetch(`${url}/api/host-mastra/agents`)).status).toBe(404);

      const hostMatchedStatus = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          `${url}/api/host-mastra/agents`,
          { headers: { host: "mastra.example.test" } },
          (res) => {
            res.resume();
            res.on("end", () => {
              resolve(res.statusCode ?? 0);
            });
          },
        );
        req.on("error", reject);
        req.end();
      });
      expect(hostMatchedStatus).toBe(200);

      const studioRes = await fetch(`${url}/api/host-mastra/studio/`);
      expect(studioRes.status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
