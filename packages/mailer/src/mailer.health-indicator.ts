import {
  type HealthIndicatorResult,
  HealthIndicatorService,
} from "@nest-boot/health-check";
import { Inject, Injectable } from "@nestjs/common";
import Mailer from "nodemailer/lib/mailer/index.js";
import SMTPPool from "nodemailer/lib/smtp-pool/index.js";
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

/** Verifies SMTP configuration when explicitly registered by the application. */
@Injectable()
export class MailerHealthIndicator {
  private readonly healthIndicator = new HealthIndicatorService();
  private pendingVerification?: Promise<true>;

  /**
   * Creates an indicator using the module-owned Nodemailer transport.
   * @param mailer - The configured mail transport.
   */
  constructor(@Inject(Mailer) private readonly mailer: Mailer) {}

  /**
   * Checks whether the configured transport supports SMTP health probes.
   * @returns Whether the transport is SMTP or pooled SMTP.
   */
  isSupported(): boolean {
    return (
      this.mailer.transporter instanceof SMTPTransport ||
      this.mailer.transporter instanceof SMTPPool
    );
  }

  /**
   * Verifies SMTP connectivity and authentication without sending a message.
   * @param key - Result key, defaulting to mailer.
   * @param timeout - Maximum probe duration in milliseconds, defaulting to 3000.
   * @returns An up or down result suitable for HealthCheckRegistry.
   */
  async check(key = "mailer", timeout = 3000): Promise<HealthIndicatorResult> {
    return await this.healthIndicator
      .check(key)
      .attempt(async () => {
        if (!this.isSupported()) {
          throw new Error("SMTP health checks require an SMTP transport");
        }

        // A probe timeout cannot cancel verify(). Keep sharing the operation
        // until it settles without closing the transport used to send mail.
        const verification = (this.pendingVerification ??= Promise.resolve()
          .then(() => this.mailer.verify())
          .catch(() => {
            // SMTP replies and transport errors can contain private details.
            throw new Error("SMTP verification failed");
          })
          .finally(() => {
            this.pendingVerification = undefined;
          }));
        await verification;
      })
      .withTimeout(timeout);
  }
}
