import { Module, Provider } from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mailer from "nodemailer/lib/mailer";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./mailer.module-definition";
import { MailerModuleOptions } from "./mailer-module-options.interface";

const mailerProvider: Provider<Mailer> = {
  provide: Mailer,
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: (options: MailerModuleOptions) => createTransport(options),
};

@Module({ providers: [mailerProvider], exports: [mailerProvider] })
export class MailerModule extends ConfigurableModuleClass {}
