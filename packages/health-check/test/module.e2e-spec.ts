import {
  Controller,
  Get,
  type INestApplication,
  Inject,
  Injectable,
  Module,
  type OnModuleInit,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

// Exercise the published ESM entry and TypeScript's constructor metadata.
import {
  HealthCheck,
  HealthCheckModule,
  HealthCheckRegistry,
  HealthCheckService,
} from "../dist/index.js";

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

@Controller("status")
class StatusController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check();
  }
}

@Module({ controllers: [StatusController] })
class StatusModule {}

describe("HealthCheckModule HTTP integration", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("shares the registry with sibling modules and supports an application-owned endpoint", async () => {
    const app = await createApp();
    expect(app.get(FeatureChecks).registry).toBe(app.get(HealthCheckRegistry));

    const response = await request(app.getHttpServer())
      .get("/status")
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
      .get("/status")
      .expect(503);
    expect(failed.body).toEqual({
      status: "error",
      info: {},
      error: { feature: { status: "down" } },
      details: { feature: { status: "down" } },
    });

    checks.healthy = true;
    await request(app.getHttpServer()).get("/status").expect(200);
  });

  it("keeps independently bootstrapped application registries isolated", async () => {
    const first = await createApp();
    const second = await createApp();
    first
      .get(HealthCheckRegistry)
      .register(() => ({ extra: { status: "down" } }));

    await request(first.getHttpServer()).get("/status").expect(503);
    const response = await request(second.getHttpServer())
      .get("/status")
      .expect(200);
    expect(response.body.details).toEqual({ feature: { status: "up" } });
  });

  async function createApp() {
    const module = await Test.createTestingModule({
      imports: [HealthCheckModule, FeatureModule, StatusModule],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    const app = module.createNestApplication();
    apps.push(app);
    await app.init();
    return app;
  }
});
