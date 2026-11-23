import { z } from "zod";

export const URL_IDENTIFIER_MIN_LENGTH = 3;
export const URL_IDENTIFIER_MAX_LENGTH = 30;

/** Trims and validates a lowercase workspace slug or username. */
export const urlIdentifierSchema = z
  .string()
  .trim()
  .min(URL_IDENTIFIER_MIN_LENGTH)
  .max(URL_IDENTIFIER_MAX_LENGTH)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
