import {
  type MiddlewareFunction,
  MiddlewareManager,
} from "@nest-boot/middleware";
import {
  Controller,
  Get,
  type INestApplication,
  Inject,
  Injectable,
  Module,
  type OnModuleInit,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

// Exercise the published ESM entry and TypeScript's constructor metadata.
import { HealthCheckModule, HealthCheckRegistry } from "../dist/index.js";

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

describe("HealthCheckModule HTTP integration", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("exposes the built-in endpoint using indicators from sibling modules", async () => {
    const app = await createApp();
    expect(app.get(FeatureChecks).registry).toBe(app.get(HealthCheckRegistry));

    const response = await request(app.getHttpServer())
      .get("/api/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(200);
    expect(response.body).toEqual({
      status: "ok",
      info: { feature: { status: "up" } },
      error: {},
      details: { feature: { status: "up" } },
    });
    await request(app.getHttpServer()).get("/health").expect(404);
  });

  it("returns 503 when an indicator fails and recovers on the next request", async () => {
    const app = await createApp();
    const checks = app.get(FeatureChecks);
    checks.healthy = false;

    const failed = await request(app.getHttpServer())
      .get("/api/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(503);
    expect(failed.body).toEqual({
      status: "error",
      info: {},
      error: { feature: { status: "down" } },
      details: { feature: { status: "down" } },
    });

    checks.healthy = true;
    await request(app.getHttpServer()).get("/api/health").expect(200);
  });

  it("keeps independently bootstrapped application registries isolated", async () => {
    const first = await createApp();
    const second = await createApp();
    first
      .get(HealthCheckRegistry)
      .register(() => ({ extra: { status: "down" } }));

    await request(first.getHttpServer()).get("/api/health").expect(503);
    const response = await request(second.getHttpServer())
      .get("/api/health")
      .expect(200);
    expect(response.body.details).toEqual({ feature: { status: "up" } });
  });

  it("keeps /api/health with a global prefix when excluded as documented", async () => {
    const app = await createApp((app) => {
      app.setGlobalPrefix("api", {
        exclude: [{ path: "api/health", method: RequestMethod.GET }],
      });
    });

    await request(app.getHttpServer()).get("/api/health").expect(200);
    await request(app.getHttpServer()).get("/api/api/health").expect(404);
  });

  it("returns a healthy result when no indicators are registered", async () => {
    const app = await createApp(undefined, false);

    const response = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);
    expect(response.body).toEqual({
      status: "ok",
      info: {},
      error: {},
      details: {},
    });
  });

  it.each([false, true])(
    "runs earlier middleware and bypasses global guards (global prefix: %s)",
    async (withPrefix) => {
      const authentication = vi.fn<MiddlewareFunction>((_req, _res, next) => {
        next();
      });
      const canActivate = vi.fn(() => {
        throw new UnauthorizedException();
      });
      const app = await createApp(
        (app) => {
          app.useGlobalGuards({ canActivate });
          if (withPrefix) {
            app.setGlobalPrefix("api", {
              exclude: [{ path: "api/health", method: RequestMethod.GET }],
            });
          }
        },
        true,
        authentication,
      );

      await request(app.getHttpServer()).get("/api/health").expect(200);
      expect(authentication).toHaveBeenCalled();
      expect(canActivate).not.toHaveBeenCalled();

      authentication.mockClear();
      app.get(FeatureChecks).healthy = false;
      await request(app.getHttpServer()).get("/api/health").expect(503);
      expect(authentication).toHaveBeenCalled();
      expect(canActivate).not.toHaveBeenCalled();

      authentication.mockClear();
      await request(app.getHttpServer())
        .get(withPrefix ? "/api/private" : "/private")
        .expect(401);
      expect(authentication).toHaveBeenCalledOnce();
      expect(canActivate).toHaveBeenCalledOnce();
    },
  );

  it("does not treat other methods or child paths as health requests", async () => {
    const authentication = vi.fn<MiddlewareFunction>((_req, _res, next) => {
      next();
    });
    const app = await createApp(undefined, true, authentication);

    await request(app.getHttpServer()).post("/api/health").expect(404);
    await request(app.getHttpServer()).get("/api/health/extra").expect(404);
    expect(authentication).toHaveBeenCalledTimes(2);
  });

  it("passes unexpected failures through Nest's exception handling", async () => {
    const app = await createApp();
    app.get(HealthCheckRegistry).register(() => {
      throw new Error("internal indicator failure");
    });

    const response = await request(app.getHttpServer())
      .get("/api/health")
      .expect("Cache-Control", "no-cache, no-store, must-revalidate")
      .expect(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: "Internal server error",
    });
  });

  it("honors rejection by earlier middleware without running health probes", async () => {
    const app = await createApp(undefined, true, (_req, _res, next) => {
      next(new UnauthorizedException());
    });
    const check = vi.fn(() => ({ extra: { status: "up" as const } }));
    app.get(HealthCheckRegistry).register(check);

    await request(app.getHttpServer()).get("/api/health").expect(401);
    expect(check).not.toHaveBeenCalled();
  });

  async function createApp(
    configure?: (app: INestApplication) => void,
    withFeatureChecks = true,
    authentication?: MiddlewareFunction,
  ) {
    const builder = Test.createTestingModule({
      controllers: [PrivateController],
      imports: [
        HealthCheckModule,
        ...(withFeatureChecks ? [FeatureModule] : []),
      ],
    }).setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    if (authentication) {
      // Register auth first to verify that it still runs before health requests.
      const manager = new MiddlewareManager();
      manager.apply(authentication).forRoutes("*");
      builder.overrideProvider(MiddlewareManager).useValue(manager);
    }
    const module = await builder.compile();
    const app = module.createNestApplication();
    apps.push(app);
    configure?.(app);
    await app.init();
    return app;
  }
});
