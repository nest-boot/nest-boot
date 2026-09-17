import { registerEnumType } from "@nest-boot/graphql";

/**
 * Workspace member status.
 */
export enum MemberStatus {
  /** Active. */
  ACTIVE = "ACTIVE",
  /** Disabled. */
  DISABLED = "DISABLED",
}

registerEnumType(MemberStatus, {
  name: "MemberStatus",
});
