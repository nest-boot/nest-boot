import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mailer from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

import { MailerQueue } from "./mailer.queue";
import { MailerService } from "./mailer.service";

export interface MailerModuleOptions {
  transport: string | SMTPTransport | SMTPTransport.Options;
}

export interface MailerModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<MailerModuleOptions> | MailerModuleOptions;
}

@Module({})
export class MailerModule {
  static register(options?: MailerModuleOptions): DynamicModule {
    const providers = [
      {
        provide: Mailer,
        useValue: createTransport(options.transport),
      },
    ];

    return {
      module: MailerModule,
      providers: [MailerService, MailerQueue, ...providers],
      exports: [MailerService],
    };
  }

  static registerAsync(options: MailerModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: MailerModule,
      imports: options.imports,
      providers: [...providers],
      exports: [...providers],
    };
  }

  private static createAsyncProviders(
    options: MailerModuleAsyncOptions
  ): Provider[] {
    return [
      {
        provide: Mailer,
        inject: options.inject || [],
        useFactory: options.useFactory,
      },
    ];
  }
}
