import type { Member } from "../entities/member.entity.js";
import type { User } from "../entities/user.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";

/** Identity and credential-limited grants used to configure one request ability. */
export interface AbilityContext<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> {
  /** Authenticated user; absent for anonymous and member API-key requests. */
  readonly user: User | null;
  /** Selected workspace with an active membership matching the credential owner. */
  readonly workspace: Workspace | null;
  /** Active user or service-account membership; absent outside an authorized workspace. */
  readonly member: Member | null;
  /** Effective user grants after applying the authenticating credential's ceiling. */
  readonly userPermissions: readonly UserPermission[];
  /** Effective grants for the selected workspace, bounded by the credential. */
  readonly workspacePermissions: readonly WorkspacePermission[];
}
