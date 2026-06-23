import type JSONTransport from "nodemailer/lib/json-transport/index.js";
import type SendmailTransport from "nodemailer/lib/sendmail-transport/index.js";
import type SESTransport from "nodemailer/lib/ses-transport/index.js";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type StreamTransport from "nodemailer/lib/stream-transport/index.js";

/** Configuration options for the mailer module (nodemailer transport options). */
export type MailerModuleOptions =
  | JSONTransport.Options
  | SESTransport.Options
  | SMTPTransport.Options
  | SendmailTransport.Options
  | StreamTransport.Options;
