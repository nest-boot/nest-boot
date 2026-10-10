import type { MailDefaults } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import { type MailerModuleOptions } from "../mailer-module-options.interface.js";

/**
 * Loads SMTP environment configuration with explicit options taking precedence.
 * @param options - Configuration for this operation.
 * @returns Mailer options derived from environment variables.
 */
export function loadMailerOptionsFromEnv(
  options?: MailerModuleOptions,
): MailerModuleOptions {
  if (options) return options;

  const url = process.env.SMTP_URL?.trim();
  if (url) return { url };

  const environmentOptions: SMTPTransport.Options = {};
  const host = process.env.SMTP_HOST;
  const port = parsePort(process.env.SMTP_PORT);
  const secure = parseBoolean(process.env.SMTP_SECURE, "SMTP_SECURE");
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;

  if (host) environmentOptions.host = host;
  if (port !== undefined) environmentOptions.port = port;
  if (secure !== undefined) environmentOptions.secure = secure;
  if (username || password) {
    environmentOptions.auth = {
      pass: password ?? "",
      user: username ?? "",
    };
  }
  return environmentOptions;
}

/**
 * Loads the default sender independently from SMTP connection options.
 * @returns Default sender options, or undefined when no sender is configured.
 */
export function loadMailerDefaultsFromEnv(): MailDefaults | undefined {
  const from = process.env.SMTP_FROM?.trim();
  return from ? { from } : undefined;
}

/**
 * Returns validated SMTP port, or undefined when absent.
 * @param value - Value to inspect or transform.
 * @returns Validated SMTP port, or undefined when absent.
 */
function parsePort(value?: string): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }
  return port;
}

/**
 * Returns parsed boolean, or undefined when no value is configured.
 * @param value - Value to inspect or transform.
 * @param name - Name used to identify the resource.
 * @returns Parsed boolean, or undefined when no value is configured.
 */
function parseBoolean(
  value: string | undefined,
  name: string,
): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be either true or false`);
}
