import { registerEnumType } from "@nest-boot/graphql";

/**
 * Workspace member status.
 */
export enum WorkspaceMemberStatus {
  /** Active. */
  ACTIVE = "ACTIVE",
  /** Disabled. */
  DISABLED = "DISABLED",
}

registerEnumType(WorkspaceMemberStatus, {
  name: "WorkspaceMemberStatus",
});
