// Exercise the published ESM entry and TypeScript's constructor metadata.
import { IS_PUBLIC_KEY } from "@nest-boot/common";
import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import {
  type CallHandler,
  type CanActivate,
  Controller,
  type DynamicModule,
  type ExecutionContext,
  Get,
  type INestApplication,
  Inject,
  Injectable,
  Module,
  type NestInterceptor,
  type OnModuleInit,
  RequestMethod,
  ServiceUnavailableException,
  type Type,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  VersioningType,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { type Observable, of, tap } from "rxjs";
import request from "supertest";

type ExpressMiddleware = (
  req: unknown,
  res: unknown,
  next: (error?: unknown) => void,
) => void;

const PROBE_TOKEN = Symbol("PROBE_TOKEN");
const HEADER_NAME = Symbol("HEADER_NAME");

@Injectable()
class FeatureChecks implements OnModuleInit {
  healthy = true;

  constructor(
    @Inject(HealthCheckRegistry) readonly registry: HealthCheckRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(() => ({
      feature: { status: this.healthy ? "up" : "down" },
    }));
  }
}

@Module({ providers: [FeatureChecks], exports: [FeatureChecks] })
class FeatureModule {}

@Controller("private")
class PrivateController {
  @Get()
  get() {
    return { private: true };
  }
}

@Injectable()
class PublicAwareAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException();
  }
}

@Injectable()
class InternalProbeGuard implements CanActivate {
  constructor(@Inject(PROBE_TOKEN) private readonly token: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    return req.headers["x-probe-token"] === this.token;
  }
}

@Injectable()
class ProbeHeaderInterceptor implements NestInterceptor {
  constructor(@Inject(HEADER_NAME) private readonly headerName: string) {}

  intercept(
    context: ExecutionContext,
    next: Parameters<NestInterceptor["intercept"]>[1],
  ) {
    const res = context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();
    return next.handle().pipe(
      tap(() => {
        res.setHeader(this.headerName, "1");
      }),
    );
  }
}

@Module({
  providers: [
    { provide: PROBE_TOKEN, useValue: "probe-secret" },
    { provide: HEADER_NAME, useValue: "x-health-intercepted" },
  ],
  exports: [PROBE_TOKEN, HEADER_NAME],
})
class ProbeSecurityModule {}

interface CreateAppOptions {
  configure?: (app: INestApplication) => void;
  withFeatureChecks?: boolean;
  healthModule?: DynamicModule | Type;
  withPublicGuard?: boolean;
}

describe("HealthCheckModule HTTP integration", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("exposes the built-in endpoint using indicators from sibling modules", async () => {
    const app = await createApp();
    expect(app.get(FeatureChecks).registry).toBe(app.get(HealthCheckRegistry));

    const response = await request(app.getHttpServer())
      .get("/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(200);
    expect(response.body).toEqual({
      status: "ok",
      info: { feature: { status: "up" } },
      error: {},
      details: { feature: { status: "up" } },
    });
    await request(app.getHttpServer()).get("/api/health").expect(404);
  });

  it("returns 503 when an indicator fails and recovers on the next request", async () => {
    const app = await createApp();
    const checks = app.get(FeatureChecks);
    checks.healthy = false;

    const failed = await request(app.getHttpServer())
      .get("/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(503);
    expect(failed.body).toEqual({
      status: "error",
      info: {},
      error: { feature: { status: "down" } },
      details: { feature: { status: "down" } },
    });

    checks.healthy = true;
    await request(app.getHttpServer()).get("/health").expect(200);
  });

  it("keeps independently bootstrapped application registries isolated", async () => {
    const first = await createApp();
    const second = await createApp();
    first
      .get(HealthCheckRegistry)
      .register(() => ({ extra: { status: "down" } }));

    await request(first.getHttpServer()).get("/health").expect(503);
    const response = await request(second.getHttpServer())
      .get("/health")
      .expect(200);
    expect(response.body.details).toEqual({ feature: { status: "up" } });
  });

  it.each(["api", "v2/nested"])(
    "follows the global prefix %s",
    async (prefix) => {
      const app = await createApp({
        configure: (app) => app.setGlobalPrefix(prefix),
      });

      await request(app.getHttpServer()).get(`/${prefix}/health`).expect(200);
      await request(app.getHttpServer()).get("/health").expect(404);
      await request(app.getHttpServer())
        .get(`/${prefix}/api/health`)
        .expect(404);
    },
  );

  it("supports explicit global prefix exclusions and URI versioning (VERSION_NEUTRAL)", async () => {
    const app = await createApp({
      configure: (app) => {
        app.enableVersioning({
          type: VersioningType.URI,
          defaultVersion: "1",
        });
        app.setGlobalPrefix("api", {
          exclude: [{ path: "health", method: RequestMethod.GET }],
        });
      },
    });

    await request(app.getHttpServer()).get("/health").expect(200);
    await request(app.getHttpServer()).get("/v1/health").expect(404);
    await request(app.getHttpServer()).get("/api/health").expect(404);
  });

  it("returns a healthy result when no indicators are registered", async () => {
    const app = await createApp({ withFeatureChecks: false });

    const response = await request(app.getHttpServer())
      .get("/health")
      .expect(200);
    expect(response.body).toEqual({
      status: "ok",
      info: {},
      error: {},
      details: {},
    });
  });

  it.each(["direct", "sync", "async"] as const)(
    "marks the controller with @Public() by default (%s registration)",
    async (mode) => {
      const healthModule =
        mode === "sync"
          ? HealthCheckModule.forRoot()
          : mode === "async"
            ? HealthCheckModule.forRootAsync({ useFactory: () => ({}) })
            : HealthCheckModule;
      const app = await createApp({
        healthModule,
        withPublicGuard: true,
      });

      await request(app.getHttpServer()).get("/health").expect(200);
      await request(app.getHttpServer()).get("/private").expect(401);
    },
  );

  it.each([false, true])(
    "supports custom path and DI-injected Nest enhancers in forRoot / forRootAsync (async: %s)",
    async (asyncRegistration) => {
      const decorators = [
        UseGuards(InternalProbeGuard),
        UseInterceptors(ProbeHeaderInterceptor),
      ];
      const healthModule = asyncRegistration
        ? HealthCheckModule.forRootAsync({
            imports: [ProbeSecurityModule],
            useFactory: () =>
              Promise.resolve({
                path: "/readyz",
                decorators,
              }),
          })
        : {
            ...HealthCheckModule.forRoot({
              path: "/readyz",
              decorators,
            }),
            imports: [
              ...(HealthCheckModule.forRoot().imports ?? []),
              ProbeSecurityModule,
            ],
          };
      const app = await createApp({ healthModule });

      await request(app.getHttpServer()).get("/health").expect(404);
      await request(app.getHttpServer()).get("/readyz").expect(403);
      await request(app.getHttpServer())
        .get("/readyz")
        .set("x-probe-token", "probe-secret")
        .expect("x-health-intercepted", "1")
        .expect("Cache-Control", "no-cache, no-store, must-revalidate")
        .expect(200);
    },
  );

  it.each([false, true])(
    "supports class-based module re-exports for forRoot and forRootAsync (async: %s)",
    async (asyncRegistration) => {
      @Module({
        imports: [
          asyncRegistration
            ? HealthCheckModule.forRootAsync({
                useFactory: () => ({ path: "/livez" }),
              })
            : HealthCheckModule.forRoot({ path: "/livez" }),
        ],
        exports: [HealthCheckModule],
      })
      class ReexportedHealthModule {}

      const app = await createApp({ healthModule: ReexportedHealthModule });
      await request(app.getHttpServer()).get("/livez").expect(200);
    },
  );

  it("bypasses @nestjs/cache-manager CacheInterceptor key factories so probes never serve cached responses", async () => {
    let healthy = true;

    @Injectable()
    class GlobalCacheLikeInterceptor implements NestInterceptor {
      private readonly store = new Map<string, unknown>();

      constructor(private readonly reflector: Reflector) {}

      async intercept(
        context: ExecutionContext,
        next: CallHandler,
      ): Promise<Observable<unknown>> {
        const keyFactoryOrValue =
          this.reflector.get<unknown>(
            "cache_module:cache_key",
            context.getHandler(),
          ) ??
          this.reflector.get<unknown>(
            "cache_module:cache_key",
            context.getClass(),
          );
        const key =
          typeof keyFactoryOrValue === "function"
            ? ((await (keyFactoryOrValue as () => unknown)()) as
                | string
                | undefined)
            : ((keyFactoryOrValue as string | undefined) ?? "/health");
        if (!key) {
          return next.handle();
        }
        if (this.store.has(key)) {
          return of(this.store.get(key));
        }
        return next.handle().pipe(
          tap((value) => {
            this.store.set(key, value);
          }),
        );
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [HealthCheckModule],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: GlobalCacheLikeInterceptor },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    apps.push(app);
    await app.init();

    app.get(HealthCheckRegistry).register(() => {
      if (!healthy) {
        throw new ServiceUnavailableException({
          status: "error",
          error: { live: { status: "down" } },
          details: { live: { status: "down" } },
        });
      }
      return { live: { status: "up" as const } };
    });

    await request(app.getHttpServer())
      .get("/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(200);

    healthy = false;
    await request(app.getHttpServer())
      .get("/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(503);
  });

  it("allows clearing default @Public() metadata with decorators: []", async () => {
    const app = await createApp({
      healthModule: HealthCheckModule.forRoot({ decorators: [] }),
      withPublicGuard: true,
    });

    await request(app.getHttpServer()).get("/health").expect(401);
  });

  it("does not treat other methods or child paths as health requests", async () => {
    const app = await createApp();

    await request(app.getHttpServer()).post("/health").expect(404);
    await request(app.getHttpServer()).get("/health/extra").expect(404);
  });

  it("passes unexpected failures through Nest's exception handling with Cache-Control", async () => {
    const app = await createApp();
    app.get(HealthCheckRegistry).register(() => {
      throw new Error("internal indicator failure");
    });

    const response = await request(app.getHttpServer())
      .get("/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: "Internal server error",
    });
  });

  it("honors rejection by earlier middleware without running health probes", async () => {
    const middleware: ExpressMiddleware = (_req, _res, next) => {
      next(new UnauthorizedException());
    };
    const app = await createApp({
      configure: (app) => {
        app.use(middleware);
      },
    });
    const check = vi.fn(() => ({ extra: { status: "up" as const } }));
    app.get(HealthCheckRegistry).register(check);

    await request(app.getHttpServer()).get("/health").expect(401);
    expect(check).not.toHaveBeenCalled();
  });

  /**
   * Returns initialized test application and its exposed dependencies.
   * @param options - Test application configuration overrides.
   * @returns Initialized test application.
   */
  async function createApp(options: CreateAppOptions = {}) {
    const {
      configure,
      withFeatureChecks = true,
      healthModule = HealthCheckModule,
      withPublicGuard = false,
    } = options;
    const module = await Test.createTestingModule({
      controllers: [PrivateController],
      imports: [healthModule, ...(withFeatureChecks ? [FeatureModule] : [])],
      providers: withPublicGuard
        ? [{ provide: APP_GUARD, useClass: PublicAwareAuthGuard }]
        : [],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    const app = module.createNestApplication();
    apps.push(app);
    configure?.(app);
    await app.init();
    return app;
  }
});
