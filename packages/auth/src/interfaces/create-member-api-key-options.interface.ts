import type { Member } from "../entities/member.entity.js";
import type { CreateApiKeyOptions } from "./create-api-key-options.interface.js";

/** Creates a workspace-scoped key for a member. */
export interface CreateMemberApiKeyOptions extends CreateApiKeyOptions {
  /** Owner entity or ID. Only self or a service account is allowed; omission uses the current member. */
  member?: Member | string;
}
