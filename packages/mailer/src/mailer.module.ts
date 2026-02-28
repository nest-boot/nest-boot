import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mailer from "nodemailer/lib/mailer";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./mailer.module-definition";
import { type MailerModuleOptions } from "./mailer-module-options.interface";

const mailerProvider: Provider<Mailer> = {
  provide: Mailer,
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: (options: MailerModuleOptions) => createTransport(options),
};

/**
 * Email sending module powered by Nodemailer.
 *
 * @remarks
 * Provides a configured Nodemailer transport instance for sending emails.
 * Accepts standard Nodemailer transport options for SMTP configuration.
 */
@Module({ providers: [mailerProvider], exports: [mailerProvider] })
export class MailerModule extends ConfigurableModuleClass {
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
}
