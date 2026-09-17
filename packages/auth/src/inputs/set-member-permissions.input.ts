import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { WorkspacePermission } from "../enums/workspace-permission.enum.js";

/** Replaces direct permissions assigned to a workspace member. */
@InputType()
export class SetMemberPermissionsInput {
  /** Complete replacement direct-permission list. */
  @ZodField((z) => z.array(z.string()))
  @Field(() => [WorkspacePermission])
  permissions!: WorkspacePermission[];
}
