import { registerEnumType } from "@nest-boot/graphql";

/** Workspace invitation status. */
export enum InvitationStatus {
  /** Accepted. */
  ACCEPTED = "accepted",
  /** Canceled. */
  CANCELED = "canceled",
  /** Pending. */
  PENDING = "pending",
  /** Rejected. */
  REJECTED = "rejected",
}

registerEnumType(InvitationStatus, {
  name: "InvitationStatus",
});
