import { registerEnumType } from "@nest-boot/graphql";

/** Workspace invitation status. */
export enum WorkspaceInvitationStatus {
  /** Accepted. */
  ACCEPTED = "accepted",
  /** Canceled. */
  CANCELED = "canceled",
  /** Pending. */
  PENDING = "pending",
  /** Rejected. */
  REJECTED = "rejected",
}

registerEnumType(WorkspaceInvitationStatus, {
  name: "WorkspaceInvitationStatus",
});
