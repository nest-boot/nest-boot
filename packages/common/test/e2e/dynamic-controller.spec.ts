import { request as httpRequest } from "node:http";

import {
  type CanActivate,
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  Controller,
  type DynamicModule,
  type ExecutionContext,
  Get,
  Global,
  type INestApplication,
  Inject,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Optional,
  Scope,
  SetMetadata,
  type Type,
  UseGuards,
} from "@nestjs/common";
import {
  APP_GUARD,
  DiscoveryModule,
  DiscoveryService,
  HttpAdapterHost,
  ModuleRef,
  Reflector,
  REQUEST,
  RouterModule,
  SerializedGraph,
} from "@nestjs/core";
import { DiscoverableMetaHostCollection } from "@nestjs/core/discovery/discoverable-meta-host-collection.js";
import { Test } from "@nestjs/testing";

import {
  createDynamicController,
  IS_PUBLIC_KEY,
  Public,
  withDynamicController,
} from "../../src/index.js";

const TENANT_NAME = Symbol("TENANT_NAME");

interface WebhookOptions {
  tenant: string;
  path?: string;
  decorators?: ClassDecorator[];
}

@Injectable()
class TenantHeaderGuard implements CanActivate {
  constructor(@Inject(TENANT_NAME) private readonly tenant: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    return req.headers["x-tenant"] === this.tenant;
  }
}

@Injectable()
class PublicGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

@Controller()
class WebhookController {
  constructor(@Inject(TENANT_NAME) private readonly tenant: string) {}

  @Get("ping")
  ping(): { tenant: string } {
    return { tenant: this.tenant };
  }
}

@Controller({ host: "hooks.example.test", path: "/default-host" })
class HostRestrictedController {
  @Get("ping")
  ping(): { hostRestricted: boolean } {
    return { hostRestricted: true };
  }
}

class UndecoratedController {
  @Get("bare")
  bare(): { bare: boolean } {
    return { bare: true };
  }
}

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<WebhookOptions>().build();

@Module({
  providers: [
    {
      provide: TENANT_NAME,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: WebhookOptions) => options.tenant,
    },
  ],
})
class WebhookModule extends ConfigurableModuleClass {
  static override register(options: WebhookOptions): DynamicModule {
    return withDynamicController(super.register(options), WebhookController, {
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (resolved: WebhookOptions) => ({
        path: resolved.path,
        decorators: resolved.decorators,
      }),
    });
  }

  static override registerAsync(
    options: ConfigurableModuleAsyncOptions<WebhookOptions>,
  ): DynamicModule {
    return withDynamicController(
      super.registerAsync(options),
      WebhookController,
      {
        inject: [MODULE_OPTIONS_TOKEN],
        useFactory: async (resolved: WebhookOptions) =>
          await Promise.resolve({
            path: resolved.path,
            decorators: resolved.decorators,
          }),
      },
    );
  }
}

describe("dynamic controller helpers", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("isolates multiple registrations, preserves base host metadata, and supports undecorated base classes", async () => {
    const { controller: rootController, provider: rootProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({ decorators: [Public()] }),
      });

    const { controller: hostController, provider: hostProvider } =
      createDynamicController(HostRestrictedController, {
        useFactory: () => ({ path: "/custom-host", decorators: [Public()] }),
      });

    const {
      controller: inheritedHostController,
      provider: inheritedHostProvider,
    } = createDynamicController(HostRestrictedController, {
      useFactory: () => ({ decorators: [Public()] }),
    });

    const { controller: disabledController, provider: disabledProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({
          enabled: false,
          path: "/webhooks/disabled",
        }),
      });

    const { controller: bareController, provider: bareProvider } =
      createDynamicController(UndecoratedController, {
        useFactory: () => ({ decorators: [Public()] }),
      });

    @Module({
      controllers: [
        rootController,
        hostController,
        inheritedHostController,
        disabledController,
        bareController,
      ],
      providers: [
        { provide: TENANT_NAME, useValue: "root" },
        rootProvider,
        hostProvider,
        inheritedHostProvider,
        disabledProvider,
        bareProvider,
      ],
    })
    class RootWebhookModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        RootWebhookModule,
        WebhookModule.register({
          tenant: "alpha",
          path: "/webhooks/alpha",
          decorators: [Public(), UseGuards(TenantHeaderGuard)],
        }),
        WebhookModule.registerAsync({
          useFactory: () =>
            Promise.resolve({
              tenant: "beta",
              path: "/webhooks/beta",
              decorators: [Public()],
            }),
        }),
      ],
      providers: [{ provide: APP_GUARD, useClass: PublicGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();

    const rootRes = await fetch(`${url}/ping`);
    expect(rootRes.status).toBe(200);
    expect(await rootRes.json()).toEqual({ tenant: "root" });

    const bareRes = await fetch(`${url}/bare`);
    expect(bareRes.status).toBe(200);
    expect(await bareRes.json()).toEqual({ bare: true });
    const bareRuntimeController = app.get<Type<UndecoratedController>>(
      bareProvider.provide,
    );
    expect(app.get(bareRuntimeController)).toBeInstanceOf(bareController);
    expect(app.get(bareRuntimeController)).toBeInstanceOf(
      UndecoratedController,
    );
    expect(app.get(disabledProvider.provide)).toBeUndefined();

    // Host restriction from HostRestrictedController must still be enforced.
    expect((await fetch(`${url}/custom-host/ping`)).status).toBe(404);
    const matchingHostRes = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = httpRequest(
          `${url}/custom-host/ping`,
          { headers: { host: "hooks.example.test" } },
          (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              body += chunk;
            });
            res.on("end", () => {
              resolve({ status: res.statusCode ?? 0, body });
            });
          },
        );
        req.on("error", reject);
        req.end();
      },
    );
    expect(matchingHostRes.status).toBe(200);
    expect(JSON.parse(matchingHostRes.body)).toEqual({ hostRestricted: true });

    const inheritedHostRes = await new Promise<{
      status: number;
      body: string;
    }>((resolve, reject) => {
      const req = httpRequest(
        `${url}/default-host/ping`,
        { headers: { host: "hooks.example.test" } },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            body += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(inheritedHostRes.status).toBe(200);
    expect(JSON.parse(inheritedHostRes.body)).toEqual({ hostRestricted: true });

    // Disabled dynamic controllers are not mounted (404 instead of 403 from PublicGuard).
    expect((await fetch(`${url}/webhooks/disabled/ping`)).status).toBe(404);

    expect((await fetch(`${url}/webhooks/alpha/ping`)).status).toBe(403);
    const alphaRes = await fetch(`${url}/webhooks/alpha/ping`, {
      headers: { "x-tenant": "alpha" },
    });
    expect(alphaRes.status).toBe(200);
    expect(await alphaRes.json()).toEqual({ tenant: "alpha" });

    const betaRes = await fetch(`${url}/webhooks/beta/ping`);
    expect(betaRes.status).toBe(200);
    expect(await betaRes.json()).toEqual({ tenant: "beta" });
  });

  it("isolates per-application metadata and enhancers when a shared dynamic module runs enabled and headless concurrently", async () => {
    const SHARED_CONFIG = Symbol("SHARED_CONFIG");
    const APP1_ONLY_DEP = Symbol("APP1_ONLY_DEP");
    const REQUIRED_ROLE_KEY = Symbol("REQUIRED_ROLE_KEY");

    interface SharedConfig {
      enabled: boolean;
      decorators?: ClassDecorator[];
    }

    @Injectable()
    class CallerAttachedGuard implements CanActivate {
      canActivate(context: ExecutionContext): boolean {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined> }>();
        return req.headers["x-caller-guard"] === "ok";
      }
    }

    @Injectable()
    class App1ExclusiveGuard implements CanActivate {
      constructor(@Inject(APP1_ONLY_DEP) private readonly secret: string) {}

      canActivate(context: ExecutionContext): boolean {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined> }>();
        return req.headers["x-app1-secret"] === this.secret;
      }
    }

    @Injectable()
    class RoleReflectorGuard implements CanActivate {
      constructor(private readonly reflector: Reflector) {}

      canActivate(context: ExecutionContext): boolean {
        const requiredRole = this.reflector.getAllAndOverride<
          string | undefined
        >(REQUIRED_ROLE_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRole) {
          return true;
        }
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined> }>();
        return req.headers["x-role"] === requiredRole;
      }
    }

    const { controller, provider } = createDynamicController(
      WebhookController,
      {
        inject: [SHARED_CONFIG],
        useFactory: (config: SharedConfig) => ({
          enabled: config.enabled,
          path: "/webhooks/shared",
          decorators: config.decorators,
        }),
      },
    );
    UseGuards(CallerAttachedGuard)(controller);

    const sharedDynamicModule: DynamicModule = {
      module: class SharedWebhookModule {},
      controllers: [controller],
      providers: [{ provide: TENANT_NAME, useValue: "shared" }, provider],
    };

    @Global()
    @Module({
      providers: [
        { provide: APP1_ONLY_DEP, useValue: "top-secret" },
        {
          provide: SHARED_CONFIG,
          useValue: {
            enabled: true,
            decorators: [
              SetMetadata(REQUIRED_ROLE_KEY, "admin"),
              UseGuards(App1ExclusiveGuard),
            ],
          } satisfies SharedConfig,
        },
      ],
      exports: [APP1_ONLY_DEP, SHARED_CONFIG],
    })
    class App1ConfigModule {}

    @Global()
    @Module({
      providers: [
        {
          provide: SHARED_CONFIG,
          useValue: { enabled: false } satisfies SharedConfig,
        },
      ],
      exports: [SHARED_CONFIG],
    })
    class App2HeadlessConfigModule {}

    const app1Module = await Test.createTestingModule({
      imports: [App1ConfigModule, sharedDynamicModule],
      providers: [{ provide: APP_GUARD, useClass: RoleReflectorGuard }],
    }).compile();
    const app1 = app1Module.createNestApplication();
    app1.useLogger(false);
    await app1.listen(0, "127.0.0.1");

    let app2: INestApplication | undefined;
    try {
      // App 2 compiles the same sharedDynamicModule without APP1_ONLY_DEP in headless mode while App 1 is live.
      const app2Module = await Test.createTestingModule({
        imports: [App2HeadlessConfigModule, sharedDynamicModule],
      }).compile();
      app2 = app2Module.createNestApplication();
      app2.useLogger(false);
      await app2.listen(0, "127.0.0.1");

      const app1Url = await app1.getUrl();
      const app2Url = await app2.getUrl();

      expect((await fetch(`${app2Url}/webhooks/shared/ping`)).status).toBe(404);

      // Caller-attached guard, dynamic guard, and dynamic class metadata all remain enforced on App 1.
      expect(
        (
          await fetch(`${app1Url}/webhooks/shared/ping`, {
            headers: {
              "x-role": "admin",
              "x-app1-secret": "top-secret",
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(`${app1Url}/webhooks/shared/ping`, {
            headers: {
              "x-caller-guard": "ok",
              "x-app1-secret": "top-secret",
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(`${app1Url}/webhooks/shared/ping`, {
            headers: {
              "x-caller-guard": "ok",
              "x-role": "admin",
            },
          })
        ).status,
      ).toBe(403);
      const okRes = await fetch(`${app1Url}/webhooks/shared/ping`, {
        headers: {
          "x-caller-guard": "ok",
          "x-role": "admin",
          "x-app1-secret": "top-secret",
        },
      });
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({ tenant: "shared" });
    } finally {
      await app2?.close();
      await app1.close();
    }
  });

  it("preserves request-scoped APP_GUARD, RouterModule-prefixed middleware binding via provider.provide, and skips disabled controller-only enhancers", async () => {
    const DISABLED_ONLY_DEP = Symbol("DISABLED_ONLY_DEP");

    @Injectable({ scope: Scope.REQUEST })
    class RequestScopedGlobalGuard implements CanActivate {
      constructor(
        @Inject(REQUEST)
        private readonly req: { headers: Record<string, string | undefined> },
      ) {}

      canActivate(): boolean {
        return this.req.headers["x-request-scoped"] === "allow";
      }
    }

    @Injectable()
    class SharedEnhancerGuard implements CanActivate {
      canActivate(context: ExecutionContext): boolean {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string | undefined> }>();
        return req.headers["x-shared-guard"] !== "deny";
      }
    }

    @Injectable()
    class DisabledFeatureOnlyGuard implements CanActivate {
      constructor(@Inject(DISABLED_ONLY_DEP) private readonly dep: string) {}

      canActivate(): boolean {
        return Boolean(this.dep);
      }
    }

    @UseGuards(DisabledFeatureOnlyGuard, SharedEnhancerGuard)
    class FeatureProtectedController {
      @Get("status")
      status(): { ok: boolean } {
        return { ok: true };
      }
    }

    const { controller: activeController, provider: activeProvider } =
      createDynamicController(UndecoratedController, {
        useFactory: () => ({
          path: "/mw-bound",
          decorators: [UseGuards(SharedEnhancerGuard)],
        }),
      });

    const { controller: skippedController, provider: skippedProvider } =
      createDynamicController(FeatureProtectedController, {
        useFactory: () => ({
          enabled: false,
          path: "/disabled-feature",
        }),
      });

    @Module({
      controllers: [activeController, skippedController],
      providers: [activeProvider, skippedProvider],
    })
    class FeatureHostModule implements NestModule {
      constructor(
        private readonly httpAdapterHost: HttpAdapterHost,
        @Optional()
        @Inject(activeProvider.provide)
        private readonly activeControllerType?: Type<UndecoratedController>,
      ) {}

      configure(consumer: MiddlewareConsumer): void {
        if (!this.activeControllerType) {
          return;
        }
        consumer
          .apply(
            (
              _req: unknown,
              res: unknown,
              next: (err?: unknown) => void,
            ): void => {
              this.httpAdapterHost.httpAdapter.setHeader(
                res,
                "x-bound-middleware",
                "hit",
              );
              next();
            },
          )
          .forRoutes(this.activeControllerType);
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        FeatureHostModule,
        RouterModule.register([{ path: "routed", module: FeatureHostModule }]),
      ],
      providers: [{ provide: APP_GUARD, useClass: RequestScopedGlobalGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();

    // Request-scoped APP_GUARD must run (403 without x-request-scoped header).
    expect((await fetch(`${url}/routed/mw-bound/bare`)).status).toBe(403);

    // SharedEnhancerGuard must remain active even though skippedController also referenced it.
    expect(
      (
        await fetch(`${url}/routed/mw-bound/bare`, {
          headers: {
            "x-request-scoped": "allow",
            "x-shared-guard": "deny",
          },
        })
      ).status,
    ).toBe(403);

    const okRes = await fetch(`${url}/routed/mw-bound/bare`, {
      headers: { "x-request-scoped": "allow" },
    });
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("x-bound-middleware")).toBe("hit");
    expect(await okRes.json()).toEqual({ bare: true });

    expect(
      (
        await fetch(`${url}/routed/disabled-feature/status`, {
          headers: { "x-request-scoped": "allow" },
        })
      ).status,
    ).toBe(404);
  });

  it("preserves controller declaration order, DiscoveryService metadata, and ModuleRef lookups", async () => {
    const DynamicProbeTag = DiscoveryService.createDecorator<string>();
    const CallerProbeTag = DiscoveryService.createDecorator<string>();

    @Injectable()
    class SnapshotNoopGuard implements CanActivate {
      canActivate(): boolean {
        return true;
      }
    }

    @Injectable()
    class DynamicSnapshotGuard implements CanActivate {
      canActivate(): boolean {
        return true;
      }
    }

    @Controller()
    class CatchAllController {
      @Get("{*path}")
      catchAll(): { source: string } {
        return { source: "catch-all" };
      }
    }

    const { controller: specificController, provider: specificProvider } =
      createDynamicController(UndecoratedController, {
        useFactory: async () => {
          await new Promise<void>((resolve) => setImmediate(resolve));
          return {
            path: "/ordered",
            decorators: [
              DynamicProbeTag("active"),
              UseGuards(DynamicSnapshotGuard),
            ],
          };
        },
      });
    CallerProbeTag("caller-attached")(specificController);
    UseGuards(SnapshotNoopGuard)(specificController);

    @DynamicProbeTag("disabled")
    @UseGuards(SnapshotNoopGuard)
    class TaggedDisabledController {
      @Get("disabled")
      disabled(): { ok: boolean } {
        return { ok: false };
      }
    }

    const { controller: disabledTagged, provider: disabledTaggedProvider } =
      createDynamicController(TaggedDisabledController, {
        useFactory: () => ({ enabled: false }),
      });

    const EARLY_LOOKUP = Symbol("EARLY_LOOKUP");

    @Module({
      imports: [DiscoveryModule],
      controllers: [specificController, disabledTagged, CatchAllController],
      providers: [
        {
          provide: EARLY_LOOKUP,
          inject: [ModuleRef],
          useFactory: (ref: ModuleRef) => {
            // Trigger early ModuleRef.instanceLinksHost caching before async dynamic controller resolves.
            expect(
              ref.get(CatchAllController, { strict: false }),
            ).toBeDefined();
            return ref;
          },
        },
        specificProvider,
        disabledTaggedProvider,
      ],
    })
    class OrderedModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [OrderedModule],
    }).compile({ snapshot: true });

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();

    expect(app.get(SerializedGraph).toJSON().status).toBe("complete");

    // Specific dynamic controller declared before CatchAllController keeps route precedence.
    const specificRes = await fetch(`${url}/ordered/bare`);
    expect(specificRes.status).toBe(200);
    expect(await specificRes.json()).toEqual({ bare: true });

    const fallbackRes = await fetch(`${url}/other/route`);
    expect(fallbackRes.status).toBe(200);
    expect(await fallbackRes.json()).toEqual({ source: "catch-all" });

    // DiscoveryService reflects both caller-attached and runtime decorators and excludes disabled controllers.
    const discovery = app.get(DiscoveryService);
    const taggedControllers = discovery.getControllers({
      metadataKey: DynamicProbeTag.KEY,
    });
    expect(taggedControllers).toHaveLength(1);
    expect(
      discovery.getControllers({ metadataKey: CallerProbeTag.KEY }),
    ).toHaveLength(1);

    // Cached ModuleRef resolves the mounted runtime controller class post-bootstrap,
    // and process-wide metaHostLinks does not retain the runtime controller class.
    const earlyRef = app.get<ModuleRef>(EARLY_LOOKUP);
    const runtimeType = app.get<Type<UndecoratedController>>(
      specificProvider.provide,
    );
    expect(earlyRef.get(runtimeType)).toBeInstanceOf(UndecoratedController);
    expect(DiscoverableMetaHostCollection.metaHostLinks.has(runtimeType)).toBe(
      false,
    );
  });

  it("supports routing @Controller() decorators with unchanged scope, rejects scope/durability changes, and rejects split module registration", async () => {
    const { controller: routedController, provider: routedProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({
          decorators: [Public(), Controller("/routed-via-decorator")],
        }),
      });

    @Controller({ scope: Scope.REQUEST, durable: true })
    class DurableRequestController {
      @Get("ping")
      ping(): { durable: boolean } {
        return { durable: true };
      }
    }

    const { controller: matchingDurable, provider: matchingDurableProvider } =
      createDynamicController(DurableRequestController, {
        useFactory: () => ({
          decorators: [
            Public(),
            Controller({
              path: "/durable-preserved",
              scope: Scope.REQUEST,
              durable: true,
            }),
          ],
        }),
      });

    @Module({
      controllers: [routedController, matchingDurable],
      providers: [
        { provide: TENANT_NAME, useValue: "decorator-routed" },
        routedProvider,
        matchingDurableProvider,
      ],
    })
    class ValidControllerDecoratorModule {}

    const validRef = await Test.createTestingModule({
      imports: [ValidControllerDecoratorModule],
      providers: [{ provide: APP_GUARD, useClass: PublicGuard }],
    }).compile();
    app = validRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const baseUrl = await app.getUrl();

    const routedRes = await fetch(`${baseUrl}/routed-via-decorator/ping`);
    expect(routedRes.status).toBe(200);
    expect(await routedRes.json()).toEqual({ tenant: "decorator-routed" });

    const durableRes = await fetch(`${baseUrl}/durable-preserved/ping`);
    expect(durableRes.status).toBe(200);
    expect(await durableRes.json()).toEqual({ durable: true });

    const { controller: splitController, provider: splitProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({ path: "/split" }),
      });

    @Module({
      providers: [splitProvider],
    })
    class SplitConfigModule {}

    @Module({
      imports: [SplitConfigModule],
      controllers: [splitController],
      providers: [{ provide: TENANT_NAME, useValue: "split-owner" }],
    })
    class SplitControllerModule {}

    await expect(
      Test.createTestingModule({
        imports: [SplitControllerModule],
      }).compile(),
    ).rejects.toThrow(
      'Dynamic controller "WebhookController" and its provider must be registered on the same module',
    );

    const { controller: scopeMutated, provider: scopeMutatedProvider } =
      createDynamicController(UndecoratedController, {
        useFactory: () => ({
          decorators: [Injectable({ scope: Scope.TRANSIENT })],
        }),
      });

    @Module({
      controllers: [scopeMutated],
      providers: [scopeMutatedProvider],
    })
    class InvalidScopeModule {}

    await expect(
      Test.createTestingModule({
        imports: [InvalidScopeModule],
      }).compile(),
    ).rejects.toThrow(
      "Dynamic controller decorators cannot change controller scope or durability",
    );

    const { controller: scopeReset, provider: scopeResetProvider } =
      createDynamicController(DurableRequestController, {
        useFactory: () => ({
          decorators: [Controller({ scope: Scope.DEFAULT })],
        }),
      });

    @Module({
      controllers: [scopeReset],
      providers: [scopeResetProvider],
    })
    class ScopeResetModule {}

    await expect(
      Test.createTestingModule({
        imports: [ScopeResetModule],
      }).compile(),
    ).rejects.toThrow(
      "Dynamic controller decorators cannot change controller scope or durability",
    );
  });

  it("supports Nest preview mode initialization while failing closed when the factory does not run in normal mode", async () => {
    const { controller: previewController, provider: previewProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({
          path: "/preview-webhook",
          decorators: [Public()],
        }),
      });
    const { controller: previewBare, provider: previewBareProvider } =
      createDynamicController(UndecoratedController, {
        useFactory: () => ({ path: "/preview-bare" }),
      });

    @Module({
      controllers: [previewController, previewBare],
      providers: [
        { provide: TENANT_NAME, useValue: "preview" },
        previewProvider,
        previewBareProvider,
      ],
    })
    class PreviewWebhookModule {}

    const previewRef = await Test.createTestingModule({
      imports: [PreviewWebhookModule],
    }).compile({ preview: true, snapshot: true });

    const previewApp = previewRef.createNestApplication({
      preview: true,
      snapshot: true,
    });
    previewApp.useLogger(false);
    try {
      await expect(previewApp.init()).resolves.toBeDefined();
      expect(previewApp.get(SerializedGraph).toJSON().status).toBe("complete");
    } finally {
      await previewApp.close();
    }

    @Injectable({ scope: Scope.REQUEST })
    class RequestScopedConfig {}

    const { controller, provider } = createDynamicController(
      WebhookController,
      {
        inject: [RequestScopedConfig],
        useFactory: () => ({
          path: "/guarded-path",
          decorators: [],
        }),
      },
    );

    @Module({
      controllers: [controller],
      providers: [
        RequestScopedConfig,
        { provide: TENANT_NAME, useValue: "scoped" },
        provider,
      ],
    })
    class MisconfiguredScopedModule {}

    await expect(
      Test.createTestingModule({
        imports: [MisconfiguredScopedModule],
      }).compile(),
    ).rejects.toThrow(
      'Dynamic controller "WebhookController" was not initialized',
    );

    @Controller({ scope: Scope.REQUEST })
    class RequestScopedBaseController {
      @Get("ping")
      ping(): { ok: boolean } {
        return { ok: true };
      }
    }

    const {
      controller: uninitRequestController,
      provider: uninitRequestProvider,
    } = createDynamicController(RequestScopedBaseController, {
      inject: [RequestScopedConfig],
      useFactory: () => ({
        path: "/scoped-base",
      }),
    });

    @Module({
      controllers: [uninitRequestController],
      providers: [RequestScopedConfig, uninitRequestProvider],
    })
    class MisconfiguredRequestBaseModule {}

    const requestBaseRef = await Test.createTestingModule({
      imports: [MisconfiguredRequestBaseModule],
    }).compile();
    app = requestBaseRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const scopedUrl = await app.getUrl();
    expect((await fetch(`${scopedUrl}/scoped-base/ping`)).status).toBe(404);
    expect((await fetch(`${scopedUrl}/ping`)).status).toBe(500);
  });

  it("rejects class decorators that return a replacement constructor", async () => {
    const replacingDecorator = ((target: new () => object) =>
      class extends target {}) as unknown as ClassDecorator;

    const { controller, provider } = createDynamicController(
      UndecoratedController,
      {
        useFactory: () => ({ decorators: [replacingDecorator] }),
      },
    );

    @Module({
      controllers: [controller],
      providers: [provider],
    })
    class InvalidDecoratorModule {}

    await expect(
      Test.createTestingModule({
        imports: [InvalidDecoratorModule],
      }).compile(),
    ).rejects.toThrow(
      "Dynamic controller decorators cannot replace the controller class",
    );
  });
});
