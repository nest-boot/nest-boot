import type JSONTransport from "nodemailer/lib/json-transport";
import type SendmailTransport from "nodemailer/lib/sendmail-transport";
import type SESTransport from "nodemailer/lib/ses-transport";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type StreamTransport from "nodemailer/lib/stream-transport";

export type MailerModuleOptions =
  | JSONTransport.Options
  | SESTransport.Options
  | SMTPTransport.Options
  | SendmailTransport.Options
  | StreamTransport.Options;
