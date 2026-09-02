import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import Mailer from "nodemailer/lib/mailer/index.js";
import SMTPConnection from "nodemailer/lib/smtp-connection/index.js";

import { MailerModule } from "./mailer.module.js";

@Injectable()
class MailerConsumer {
  constructor(readonly mailer: Mailer) {}
}

@Module({ providers: [MailerConsumer] })
class FeatureModule {}

describe("MailerModule", () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
    vi.unstubAllEnvs();
  });

  it("loads SMTP configuration from the environment on direct import", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_SECURE", "true");
    vi.stubEnv("SMTP_USERNAME", "mailer-user");
    vi.stubEnv("SMTP_PASSWORD", "mailer-password");

    const module = await compile(MailerModule, FeatureModule);
    const mailer = module.get(Mailer);
    const consumer = module.get(MailerConsumer);

    expect(consumer.mailer).toBe(mailer);
    expect(mailer.options).toMatchObject({
      auth: {
        pass: "mailer-password",
        user: "mailer-user",
      },
      host: "smtp.example.com",
      port: 465,
      secure: true,
    });
  });

  it.each([
    ["smtp://mailer-user:mailer-password@smtp.example.com", 587],
    ["smtps://mailer-user:mailer-password@smtp.example.com", 465],
  ])("uses Nodemailer defaults for %s", async (url, expectedPort) => {
    vi.stubEnv("SMTP_URL", url);
    vi.stubEnv("SMTP_HOST", "ignored.example.com");
    vi.stubEnv("SMTP_PORT", "invalid");
    vi.stubEnv("SMTP_FROM", "Example <no-reply@example.com>");

    const module = await compile(MailerModule);
    const mailer = module.get(Mailer);
    const connection = new SMTPConnection(mailer.options);

    expect(mailer.options).toMatchObject({
      auth: {
        pass: "mailer-password",
        user: "mailer-user",
      },
      host: "smtp.example.com",
    });
    expect(connection.port).toBe(expectedPort);
    expect(mailer._defaults.from).toBe("Example <no-reply@example.com>");
  });

  it("lets registered options override environment configuration", async () => {
    vi.stubEnv(
      "SMTP_URL",
      "smtps://environment-user:environment-password@url.example.com",
    );
    vi.stubEnv("SMTP_HOST", "environment.example.com");
    vi.stubEnv("SMTP_PORT", "465");

    const module = await compile(
      MailerModule.register({
        host: "registered.example.com",
        port: 587,
        secure: false,
      }),
    );

    expect(module.get(Mailer).options).toMatchObject({
      host: "registered.example.com",
      port: 587,
      secure: false,
    });
  });

  it("supports asynchronous registration", async () => {
    const useFactory = vi.fn(() => ({
      host: "async.example.com",
      port: 2525,
    }));
    const module = await compile(MailerModule.registerAsync({ useFactory }));

    expect(useFactory).toHaveBeenCalledOnce();
    expect(module.get(Mailer).options).toMatchObject({
      host: "async.example.com",
      port: 2525,
    });
  });

  it("rejects invalid SMTP environment values", async () => {
    vi.stubEnv("SMTP_PORT", "invalid");

    await expect(compile(MailerModule)).rejects.toThrow(
      "SMTP_PORT must be an integer between 1 and 65535",
    );
  });

  async function compile(
    mailerModule:
      | typeof MailerModule
      | ReturnType<typeof MailerModule.register>,
    featureModule?: typeof FeatureModule,
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [mailerModule, ...(featureModule ? [featureModule] : [])],
    }).compile();
    modules.push(module);
    return module;
  }
});
