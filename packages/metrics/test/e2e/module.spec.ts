import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
import {
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  type INestApplication,
  Inject,
  Injectable,
  Module,
  type NestInterceptor,
  type Type,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  VersioningType,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { type RegistryContentType } from "prom-client";
import { tap } from "rxjs";
import request from "supertest";

import { MetricsModule, Registry } from "../../src/index.js";

const SCRAPE_TOKEN = Symbol("SCRAPE_TOKEN");

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
class ScrapeTokenGuard implements CanActivate {
  constructor(@Inject(SCRAPE_TOKEN) private readonly token: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    return req.headers["x-scrape-token"] === this.token;
  }
}

@Injectable()
class MetricsHeaderInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: Parameters<NestInterceptor["intercept"]>[1],
  ) {
    const res = context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();
    return next.handle().pipe(
      tap(() => {
        res.setHeader("x-metrics-intercepted", "1");
      }),
    );
  }
}

@Module({
  providers: [{ provide: SCRAPE_TOKEN, useValue: "scrape-secret" }],
  exports: [SCRAPE_TOKEN],
})
class ScrapeAuthModule {}

describe("MetricsModule HTTP integration", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it.each(["api", "v2/nested"])(
    "follows the global prefix %s and stays VERSION_NEUTRAL under URI versioning",
    async (prefix) => {
      const moduleRef = await Test.createTestingModule({
        imports: [MetricsModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      apps.push(app);
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: "1",
      });
      app.setGlobalPrefix(prefix);
      await app.init();

      const response = await request(app.getHttpServer())
        .get(`/${prefix}/metrics`)
        .expect(200);
      expect(response.text).toContain("process_cpu_user_seconds_total");
      expect(normalizeContentType(response.headers["content-type"])).toEqual(
        normalizeContentType(app.get(Registry).contentType),
      );
      await request(app.getHttpServer()).get("/metrics").expect(404);
      await request(app.getHttpServer())
        .get(`/${prefix}/v1/metrics`)
        .expect(404);
    },
  );

  it("should expose default metrics from a statically registered module", async () => {
    const response = await getMetrics(MetricsModule);

    expect(response.text).toContain(
      "# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    );
    expect(response.text).toContain("process_cpu_user_seconds_total");
  });

  it("should expose synchronously configured metrics", async () => {
    const response = await getMetrics(
      MetricsModule.forRoot({
        labels: { service: "metrics-e2e" },
        prefix: "sync_e2e_",
      }),
    );

    expect(response.text).toContain(
      "# HELP sync_e2e_process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    );
    expect(response.text).toContain('service="metrics-e2e"');
  });

  it("should expose asynchronously configured metrics", async () => {
    const response = await getMetrics(
      MetricsModule.forRootAsync({
        useFactory: () => Promise.resolve({ prefix: "async_e2e_" }),
      }),
    );

    expect(response.text).toContain(
      "# HELP async_e2e_process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    );
  });

  it("should expose the content type configured on the registry", async () => {
    const response = await getMetrics(MetricsModule, (registry) => {
      registry.setContentType(Registry.OPENMETRICS_CONTENT_TYPE);
    });

    expect(normalizeContentType(response.headers["content-type"])).toEqual(
      normalizeContentType(Registry.OPENMETRICS_CONTENT_TYPE),
    );
    expect(response.text.trimEnd().endsWith("# EOF")).toBe(true);
  });

  it.each(["direct", "sync", "async"] as const)(
    "does not mark the metrics endpoint as @Public() by default (%s registration)",
    async (mode) => {
      const metricsModule =
        mode === "sync"
          ? MetricsModule.forRoot()
          : mode === "async"
            ? MetricsModule.forRootAsync({ useFactory: () => ({}) })
            : MetricsModule;
      const moduleRef = await Test.createTestingModule({
        imports: [metricsModule],
        providers: [{ provide: APP_GUARD, useClass: PublicAwareAuthGuard }],
      }).compile();
      const app = moduleRef.createNestApplication();
      apps.push(app);
      await app.init();

      await request(app.getHttpServer()).get("/metrics").expect(401);
    },
  );

  it.each([false, true])(
    "supports custom path and decorators including @Public() and Nest enhancers (async: %s)",
    async (asyncRegistration) => {
      const decorators = [
        Public(),
        UseGuards(ScrapeTokenGuard),
        UseInterceptors(MetricsHeaderInterceptor),
      ];
      const metricsModule = asyncRegistration
        ? MetricsModule.forRootAsync({
            imports: [ScrapeAuthModule],
            useFactory: () =>
              Promise.resolve({
                prefix: "custom_async_",
                path: "/internal/metrics",
                decorators,
              }),
          })
        : {
            ...MetricsModule.forRoot({
              prefix: "custom_sync_",
              path: "/internal/metrics",
              decorators,
            }),
            imports: [ScrapeAuthModule],
          };

      const moduleRef = await Test.createTestingModule({
        imports: [metricsModule],
        providers: [{ provide: APP_GUARD, useClass: PublicAwareAuthGuard }],
      }).compile();
      const app = moduleRef.createNestApplication();
      apps.push(app);
      await app.init();

      await request(app.getHttpServer()).get("/metrics").expect(404);
      await request(app.getHttpServer()).get("/internal/metrics").expect(403);
      const response = await request(app.getHttpServer())
        .get("/internal/metrics")
        .set("x-scrape-token", "scrape-secret")
        .expect("x-metrics-intercepted", "1")
        .expect(200);
      expect(response.text).toContain(
        asyncRegistration
          ? "custom_async_process_cpu_user_seconds_total"
          : "custom_sync_process_cpu_user_seconds_total",
      );
    },
  );

  /**
   * Returns HTTP response from the configured metrics endpoint.
   * @param metricsModule - Metrics module registration to test.
   * @param configureRegistry - Callback that registers metrics for the test.
   * @returns HTTP response from the configured metrics endpoint.
   */
  async function getMetrics(
    metricsModule: DynamicModule | Type,
    configureRegistry?: (registry: Registry<RegistryContentType>) => void,
  ): Promise<request.Response> {
    const moduleRef = await Test.createTestingModule({
      imports: [metricsModule],
    }).compile();
    const registry = moduleRef.get(Registry);
    configureRegistry?.(registry);
    const app = moduleRef.createNestApplication();
    apps.push(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200);
    const responseContentType = response.headers["content-type"];

    expect(normalizeContentType(responseContentType)).toEqual(
      normalizeContentType(registry.contentType),
    );

    return response;
  }
});

/**
 * Returns normalized media type and parameter components.
 * @param value - Value to inspect or transform.
 * @returns Normalized media type and parameter components.
 */
function normalizeContentType(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .sort();
}
