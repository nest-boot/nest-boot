import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { WorkspaceMemberStatus } from "../enums/workspace-member-status.enum.js";

/** Input for updating a workspace member. */
@InputType()
export class UpdateWorkspaceMemberInput {
  /** Workspace-visible member name; does not update the user's profile. */
  @ZodField((z) => z.string().trim().min(1).max(255).optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** Workspace-visible contact email; does not change the login email. Null clears it. */
  @ZodField((z) => z.email().max(255).nullish())
  @Field(() => String, { nullable: true })
  email?: string | null;

  /** WorkspaceMember status. */
  @ZodField((z) =>
    z
      .enum(WorkspaceMemberStatus, {
        error: "Status must be a valid member status",
      })
      .optional(),
  )
  @Field(() => WorkspaceMemberStatus, { nullable: true })
  status?: WorkspaceMemberStatus;
}
