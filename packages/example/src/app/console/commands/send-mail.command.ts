/* eslint-disable no-console */

import { Command, Positional } from "@nest-boot/command";
import { MailerService } from "@nest-boot/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SendMailCommand {
  constructor(private readonly mailerService: MailerService) {
    return this;
  }

  @Command({
    command: "send:mail <from> <to> <message>",
    describe: "命令描述",
  })
  async handle(
    @Positional({
      name: "from",
      describe: "发件人",
      type: "string",
    })
    from: string,
    @Positional({
      name: "to",
      describe: "收件人",
      type: "string",
    })
    to: string,
    @Positional({
      name: "message",
      describe: "消息",
      type: "string",
    })
    message: string
  ): Promise<void> {
    await this.mailerService.send({
      from,
      to,
      subject: "Test",
      template: "emails/test.njk",
      context: { message },
    });
  }
}
