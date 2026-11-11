import { registerEnumType } from "@nest-boot/graphql";

/** Identity represented by a workspace member. */
export enum MemberType {
  /** A membership linked to a login user. */
  USER = "USER",
  /** A workspace identity used by automation, without a login user. */
  SERVICE_ACCOUNT = "SERVICE_ACCOUNT",
}

registerEnumType(MemberType, { name: "MemberType" });
