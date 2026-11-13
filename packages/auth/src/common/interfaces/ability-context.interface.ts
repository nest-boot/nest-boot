import type { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import type { User } from "../../core/entities/user.entity.js";
import type { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";

/** Identity and credential-limited grants used to configure one request ability. */
export interface AbilityContext<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> {
  /** Independent system principal, absent for human and member credentials. */
  readonly systemAccount?: SystemAccount | null;
  /** Authenticated user; absent for anonymous and member API-key requests. */
  readonly user: User | null;
  /** Selected workspace with an active membership matching the credential owner. */
  readonly workspace: Workspace | null;
  /** Active user or service-account membership; absent outside an authorized workspace. */
  readonly member: WorkspaceMember | null;
  /** Effective user grants after applying the authenticating credential's ceiling. */
  readonly userPermissions: readonly UserPermission[];
  /** Effective grants for the selected workspace, bounded by the credential. */
  readonly workspacePermissions: readonly WorkspacePermission[];
}
