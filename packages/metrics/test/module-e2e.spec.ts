import {
  type DynamicModule,
  type INestApplication,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { MetricsModule, Registry } from "../src";

describe("MetricsModule HTTP integration", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("should expose default metrics from a statically registered module", async () => {
    const response = await getMetrics(MetricsModule);

    expect(response.text).toContain(
      "# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    );
    expect(response.text).toContain("process_cpu_user_seconds_total");
  });

  it("should expose synchronously configured metrics", async () => {
    const response = await getMetrics(
      MetricsModule.register({
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
      MetricsModule.registerAsync({
        useFactory: () => Promise.resolve({ prefix: "async_e2e_" }),
      }),
    );

    expect(response.text).toContain(
      "# HELP async_e2e_process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    );
  });

  async function getMetrics(
    metricsModule: DynamicModule | Type,
  ): Promise<request.Response> {
    const moduleRef = await Test.createTestingModule({
      imports: [metricsModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    apps.push(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200);
    const contentType = response.headers["content-type"];

    expect(normalizeContentType(contentType)).toEqual(
      normalizeContentType(Registry.PROMETHEUS_CONTENT_TYPE),
    );

    return response;
  }
});

function normalizeContentType(contentType: string): string[] {
  return contentType
    .split(";")
    .map((part) => part.trim())
    .sort();
}
