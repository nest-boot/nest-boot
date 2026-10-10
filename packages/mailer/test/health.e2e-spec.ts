import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import {
  type INestApplication,
  Inject,
  Injectable,
  Module,
  type OnModuleInit,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Mailer, MailerHealthIndicator, MailerModule } from "../dist/index.js";
import { createSmtpServer } from "./helpers/smtp-server.js";

@Injectable()
class MailerHealthRegistration implements OnModuleInit {
  constructor(
    @Inject(HealthCheckRegistry) private readonly registry: HealthCheckRegistry,
    @Inject(MailerHealthIndicator)
    private readonly indicator: MailerHealthIndicator,
  ) {}

  onModuleInit(): void {
    if (this.indicator.isSupported()) {
      this.registry.register(() => this.indicator.check("mailer", 200));
    }
  }
}

@Module({ providers: [MailerHealthRegistration] })
class FeatureModule {}

describe("Mailer health HTTP integration", () => {
  let app: INestApplication | undefined;
  let smtp: Awaited<ReturnType<typeof createSmtpServer>>;

  beforeEach(async () => {
    smtp = await createSmtpServer();
  });

  afterEach(async () => {
    smtp.resume();
    app?.get<Mailer>(Mailer).close();
    await app?.close();
    app = undefined;
    await smtp.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /**
   * Creates a real HTTP app with optional application-owned health registration.
   * @param enabled - Whether the application opts in to SMTP health checks.
   * @param registration - Module configuration variant.
   * @param pooled - Whether to configure pooled SMTP.
   * @returns The configured Mailer and its verification spy.
   */
  async function createApp(
    enabled = true,
    registration: "direct" | "sync" | "async" | "json" = "sync",
    pooled = false,
  ) {
    const options = {
      url: `smtp://health-user:health-password@127.0.0.1:${String(smtp.port)}?pool=${String(pooled)}`,
    };
    vi.stubEnv("SMTP_URL", options.url);
    const mailerModule =
      registration === "direct"
        ? MailerModule
        : registration === "async"
          ? MailerModule.registerAsync({ useFactory: () => options })
          : MailerModule.register(
              registration === "json" ? { jsonTransport: true } : options,
            );
    const module = await Test.createTestingModule({
      imports: [
        mailerModule,
        HealthCheckModule,
        ...(enabled ? [FeatureModule] : []),
      ],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    app = module.createNestApplication();
    const mailer = app.get<Mailer>(Mailer);
    const verify = vi.spyOn(mailer, "verify");
    await app.listen(0, "127.0.0.1");
    expect(verify).not.toHaveBeenCalled();
    expect(smtp.state.connections).toBe(0);
    return { mailer, verify };
  }

  /**
   * Requests the application's health endpoint.
   * @returns HTTP status and parsed health result.
   */
  async function health() {
    if (!app) throw new Error("HTTP application has not been initialized");
    const response = await fetch(`${await app.getUrl()}/api/health`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  }

  it("does not register checks or open SMTP connections by default", async () => {
    const { verify } = await createApp(false);
    expect(await health()).toMatchObject({
      status: 200,
      body: { details: {} },
    });
    expect(app?.get(HealthCheckRegistry).healthIndicators).toHaveLength(0);
    expect(verify).not.toHaveBeenCalled();
    expect(smtp.state.connections).toBe(0);
  });

  it.each(["direct", "sync", "async"] as const)(
    "supports explicit checks with %s registration",
    async (registration) => {
      await createApp(true, registration);
      expect(await health()).toMatchObject({
        status: 200,
        body: { details: { mailer: { status: "up" } } },
      });
      expect(smtp.commands).toContain("AUTH");
      expect(smtp.commands).not.toContain("MAIL");
      expect(smtp.commands).not.toContain("DATA");
      await expect.poll(() => smtp.sockets.size).toBe(0);
    },
  );

  it("supports pooled SMTP verification without sending a message", async () => {
    await createApp(true, "sync", true);
    expect((await health()).status).toBe(200);
    expect(smtp.commands).toContain("AUTH");
    expect(smtp.commands).not.toContain("MAIL");
    await expect.poll(() => smtp.sockets.size).toBe(0);
  });

  it("skips JSON transports when the application checks support", async () => {
    const { verify } = await createApp(true, "json");
    expect((await health()).status).toBe(200);
    expect(app?.get(HealthCheckRegistry).healthIndicators).toHaveLength(0);
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns 503 on authentication failure and recovers", async () => {
    await createApp();
    smtp.state.authenticate = false;
    expect(await health()).toMatchObject({
      status: 503,
      body: {
        error: {
          mailer: { status: "down", message: "SMTP verification failed" },
        },
      },
    });
    smtp.state.authenticate = true;
    expect((await health()).status).toBe(200);
  });

  it("returns 503 when the SMTP server is unreachable", async () => {
    await createApp();
    await smtp.close();
    expect(await health()).toMatchObject({
      status: 503,
      body: { error: { mailer: { status: "down" } } },
    });
  });

  it("bounds stalled probes, shares verification, and recovers", async () => {
    const { mailer, verify } = await createApp();
    const close = vi.spyOn(mailer, "close");
    smtp.state.stalled = true;
    expect((await health()).status).toBe(503);
    expect((await health()).status).toBe(503);
    expect(verify).toHaveBeenCalledOnce();
    expect(smtp.state.connections).toBe(1);
    expect(close).not.toHaveBeenCalled();

    smtp.resume();
    expect((await health()).status).toBe(200);
    await expect.poll(() => smtp.sockets.size).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });
});
