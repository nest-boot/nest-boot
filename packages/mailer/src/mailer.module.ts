import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mailer from "nodemailer/lib/mailer/index.js";

import { MailerHealthIndicator } from "./mailer.health-indicator.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mailer.module-definition.js";
import { type MailerModuleOptions } from "./mailer-module-options.interface.js";
import {
  loadMailerDefaultsFromEnv,
  loadMailerOptionsFromEnv,
} from "./utils/load-mailer-options-from-env.util.js";

const mailerProvider: Provider<Mailer> = {
  provide: Mailer,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: MailerModuleOptions) =>
    createTransport(
      loadMailerOptionsFromEnv(options),
      loadMailerDefaultsFromEnv(),
    ),
};

/**
 * Global email sending module powered by Nodemailer.
 *
 * Import the module directly to configure SMTP from environment variables, or
 * use {@link MailerModule.register} and {@link MailerModule.registerAsync} for
 * explicit Nodemailer transport options.
 * Closes the transport when the Nest application shuts down.
 */
@Global()
@Module({
  providers: [mailerProvider, MailerHealthIndicator],
  exports: [mailerProvider, MailerHealthIndicator],
})
export class MailerModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  /**
   * Registers the MailerModule with the given options.
   * @param options - Nodemailer transport configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the MailerModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /**
   * Creates the module that owns the configured mail transport.
   * @param mailer - Nodemailer transport provided by this module.
   */
  constructor(@Inject(Mailer) private readonly mailer: Mailer) {
    super();
  }

  /** Closes the transport and releases pooled SMTP connections on shutdown. */
  onApplicationShutdown(): void {
    this.mailer.close();
  }
}
