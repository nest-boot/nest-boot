import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import type { CreateApiKeyOptions } from "./create-api-key-options.interface.js";

/** Creates a workspace-scoped key for a member. */
export interface CreateWorkspaceApiKeyOptions extends CreateApiKeyOptions {
  /** Owner entity or ID. Only self or a service account is allowed; omission creates a service account. */
  member?: WorkspaceMember | string;
}
