import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { WorkspaceRole } from "../enums/workspace-role.enum.js";

/** Replaces the roles assigned to a workspace member. */
@InputType()
export class SetMemberRolesInput {
  /** Complete replacement role list; at least one role is required. */
  @ZodField((z) => z.array(z.string()).min(1))
  @Field(() => [WorkspaceRole])
  roles!: WorkspaceRole[];
}
