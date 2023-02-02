import JSONTransport from "nodemailer/lib/json-transport";
import SendmailTransport from "nodemailer/lib/sendmail-transport";
import SESTransport from "nodemailer/lib/ses-transport";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import StreamTransport from "nodemailer/lib/stream-transport";

export type MailerModuleOptions =
  | JSONTransport.Options
  | SESTransport.Options
  | SMTPTransport.Options
  | SendmailTransport.Options
  | StreamTransport.Options;
