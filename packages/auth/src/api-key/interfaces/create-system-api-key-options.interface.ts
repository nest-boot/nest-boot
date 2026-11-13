import type { CreateApiKeyOptions } from "./create-api-key-options.interface.js";

/** Creates a system credential and, when omitted, its independent account. */
export interface CreateSystemApiKeyOptions extends CreateApiKeyOptions {
  /** Existing account ID; omission creates an account with the key's name and grants. */
  systemAccountId?: string | null;
}
