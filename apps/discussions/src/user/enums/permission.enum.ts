import { registerEnumType } from "@nestjs/graphql";

export enum UserPermission {
  ADMIN = "ADMIN",
}

registerEnumType(UserPermission, { name: "UserPermission" });
