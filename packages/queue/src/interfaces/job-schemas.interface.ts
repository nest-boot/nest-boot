import type { ZodObject, ZodType } from "zod";

/** Validation contract for one named job. An omitted result means void. */
export interface JobSchema {
  data: ZodObject;
  result?: ZodType;
}

/** Allowed job names and their data/result contracts. */
export type JobSchemas = Record<string, JobSchema>;
