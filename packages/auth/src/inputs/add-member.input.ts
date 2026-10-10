import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { MemberType } from "../enums/member-type.enum.js";
import { WorkspacePermission } from "../enums/workspace-permission.enum.js";
import { WorkspaceRole } from "../enums/workspace-role.enum.js";

/** Input for directly adding a workspace member. */
@InputType()
export class AddMemberInput {
  /** Identity type; omitted means a user membership. */
  @ZodField((z) => z.enum(MemberType).optional())
  @Field(() => MemberType, { nullable: true })
  type?: MemberType;

  /** Service account display name; required for SERVICE_ACCOUNT. */
  @ZodField((z) => z.string().trim().min(1).max(255).optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** Initial roles; omitted uses the default role. Service accounts may use an empty list. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [WorkspaceRole], { nullable: true })
  roles?: WorkspaceRole[];

  /** Initial direct permissions, limited to the issuer's workspace grants. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [WorkspacePermission], { nullable: true })
  permissions?: WorkspacePermission[];

  /** Email address of the existing login user; required for USER. */
  @ZodField((z) => z.email().max(255).optional())
  @Field(() => String, { nullable: true })
  email?: string;
}
