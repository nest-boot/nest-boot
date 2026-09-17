import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { MemberStatus } from "../enums/member-status.enum.js";

/** Input for updating a workspace member. */
@InputType()
export class UpdateMemberInput {
  /** Workspace-visible member name; does not update the user's profile. */
  @ZodField((z) => z.string().min(1).max(255).optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** Workspace-visible contact email; does not change the login email. Null clears it. */
  @ZodField((z) => z.email().max(255).nullish())
  @Field(() => String, { nullable: true })
  email?: string | null;

  /** Member status. */
  @ZodField((z) =>
    z
      .enum(MemberStatus, { error: "Status must be a valid member status" })
      .optional(),
  )
  @Field(() => MemberStatus, { nullable: true })
  status?: MemberStatus;
}
