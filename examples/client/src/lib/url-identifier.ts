import { z } from "zod";

export const urlIdentifierInput = {
  minLength: 3,
  maxLength: 30,
  pattern: "[a-z][a-z0-9]*(-[a-z0-9]+)*",
};

export function createUrlIdentifierSchema(message: string) {
  return z
    .string()
    .trim()
    .min(urlIdentifierInput.minLength, message)
    .max(urlIdentifierInput.maxLength, message)
    .regex(new RegExp(`^(?:${urlIdentifierInput.pattern})$`), message);
}
