import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { UserPermission } from "../enums/user-permission.enum.js";

/** Replaces application permissions on a user. */
@InputType()
export class SetUserPermissionsInput {
  /** Complete replacement permission list. */
  @ZodField((z) => z.array(z.string()))
  @Field(() => [UserPermission])
  permissions!: UserPermission[];
}
