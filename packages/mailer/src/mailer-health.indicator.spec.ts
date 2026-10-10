import { createTransport } from "nodemailer";
import type Mailer from "nodemailer/lib/mailer/index.js";

import { MailerHealthIndicator } from "./mailer-health.indicator.js";

describe("MailerHealthIndicator", () => {
  const mailers: Mailer[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const mailer of mailers.splice(0)) mailer.close();
  });

  /**
   * Creates an SMTP transport without opening a connection.
   * @param pooled - Whether to use an SMTP connection pool.
   * @returns The indicator and spies for the module-owned transport.
   */
  function setup(pooled = false) {
    const mailer = createTransport({
      url: `smtp://localhost?pool=${String(pooled)}`,
    });
    mailers.push(mailer);
    return {
      indicator: new MailerHealthIndicator(mailer),
      verify: vi.spyOn(mailer, "verify").mockResolvedValue(true),
      close: vi.spyOn(mailer, "close"),
      sendMail: vi.spyOn(mailer, "sendMail"),
    };
  }

  it.each([false, true])(
    "verifies SMTP configuration without sending mail (pool: %s)",
    async (pooled) => {
      const { indicator, verify, close, sendMail } = setup(pooled);
      expect(indicator.isSupported()).toBe(true);
      expect(verify).not.toHaveBeenCalled();
      expect(await indicator.check()).toMatchObject({
        mailer: { status: "up" },
      });
      expect(verify).toHaveBeenCalledOnce();
      expect(sendMail).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    },
  );

  it.each([
    { jsonTransport: true },
    { streamTransport: true },
    { sendmail: true },
  ])("does not verify unsupported transports: %j", async (options) => {
    const mailer = createTransport(options);
    mailers.push(mailer);
    const verify = vi.spyOn(mailer, "verify");
    const indicator = new MailerHealthIndicator(mailer);

    expect(indicator.isSupported()).toBe(false);
    expect(await indicator.check()).toMatchObject({
      mailer: {
        status: "down",
        message: "SMTP health checks require an SMTP transport",
      },
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("reports a sanitized failure and recovers on the next check", async () => {
    const { indicator, verify } = setup();
    verify.mockRejectedValueOnce(new Error("SMTP authentication details"));

    const result = await indicator.check("smtp");
    expect(result).toMatchObject({
      smtp: { status: "down", message: "SMTP verification failed" },
    });
    expect(JSON.stringify(result)).not.toContain("authentication details");
    expect(await indicator.check("smtp")).toMatchObject({
      smtp: { status: "up" },
    });
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("handles a synchronous verification error", async () => {
    const { indicator, verify } = setup();
    verify.mockImplementationOnce(() => {
      throw new Error("SMTP configuration details");
    });
    expect(await indicator.check()).toMatchObject({
      mailer: { status: "down", message: "SMTP verification failed" },
    });
    expect(await indicator.check()).toMatchObject({
      mailer: { status: "up" },
    });
  });

  it("shares one verification between concurrent checks with different keys", async () => {
    const { indicator, verify } = setup();
    const pending = deferredVerification();
    verify.mockReturnValueOnce(pending.promise);
    const checks = [indicator.check("first"), indicator.check("second")];
    pending.resolve(true);

    expect(await Promise.all(checks)).toMatchObject([
      { first: { status: "up" } },
      { second: { status: "up" } },
    ]);
    expect(verify).toHaveBeenCalledOnce();
  });

  it.each(["resolve", "reject"] as const)(
    "bounds stalled probes and permits recovery after a late %s",
    async (settlement) => {
      const { indicator, verify, close } = setup();
      const pending = deferredVerification();
      verify.mockReturnValueOnce(pending.promise);

      for (let attempt = 0; attempt < 2; attempt++) {
        expect(await indicator.check("smtp", 10)).toMatchObject({
          smtp: { status: "down", message: "timeout of 10ms exceeded" },
        });
      }
      expect(verify).toHaveBeenCalledOnce();
      expect(close).not.toHaveBeenCalled();

      const recovery = indicator.check();
      if (settlement === "resolve") pending.resolve(true);
      else pending.reject(new Error("Late SMTP failure"));
      expect(await recovery).toMatchObject({
        mailer: { status: settlement === "resolve" ? "up" : "down" },
      });
      expect(await indicator.check()).toMatchObject({
        mailer: { status: "up" },
      });
      expect(verify).toHaveBeenCalledTimes(2);
      expect(close).not.toHaveBeenCalled();
    },
  );
});

/**
 * Creates a verification promise controlled by the test.
 * @returns Promise and its settlement functions.
 */
function deferredVerification() {
  let resolve!: (value: true) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<true>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
