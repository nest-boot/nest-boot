import { Address } from "nodemailer/lib/mailer";

export interface SendOptions {
  to: string | Address | (string | Address)[];
  from?: string | Address;
  subject: string;
  content?: string;
  template?: string;
  context?: Record<string, unknown>;
}
