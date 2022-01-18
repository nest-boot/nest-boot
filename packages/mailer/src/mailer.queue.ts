import { BaseQueue, Job, Queue } from "@nest-boot/queue";
import { ConfigService } from "@nestjs/config";
import mjml2html from "mjml";
import Mailer from "nodemailer/lib/mailer";
import { Environment as TemplateEngine, FileSystemLoader } from "nunjucks";
import { resolve } from "path";

import { SendOptions } from "./send-options.interface";

@Queue()
export class MailerQueue extends BaseQueue<SendOptions> {
  private readonly templateEngine: TemplateEngine;

  constructor(
    private readonly mailer: Mailer,
    private readonly configService: ConfigService
  ) {
    super();

    this.templateEngine = new TemplateEngine(
      new FileSystemLoader(resolve(process.cwd(), `./templates`))
    );
  }

  async processor({ data: options }: Job<SendOptions>): Promise<void> {
    try {
      let html: string = options.content
        ? this.templateEngine.renderString(options.content, options.context)
        : this.templateEngine.render(options.template, options.context);

      if (/^[\s]*?<mjml>/.test(html)) {
        const results = mjml2html(html);

        if (results.errors.length > 0) {
          throw new Error(
            `${results.errors[0].line}: ${results.errors[0].message}`
          );
        } else {
          html = results.html;
        }
      }

      await this.mailer.sendMail({
        from: {
          name: this.configService.get(
            "MAIL_FROM_NAME",
            this.configService.get("APP_NAME")
          ),
          address: this.configService.get("MAIL_FROM_ADDRESS"),
        },
        ...options,
        html,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);

      throw err;
    }
  }
}
