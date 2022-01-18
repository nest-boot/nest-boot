import { Injectable } from "@nestjs/common";

import { MailerQueue } from "./mailer.queue";
import { SendOptions } from "./send-options.interface";

@Injectable()
export class MailerService {
  constructor(private readonly mailerQueue: MailerQueue) {
    return this;
  }

  async send(options: SendOptions): Promise<void> {
    await this.mailerQueue.add("", options);
  }
}
