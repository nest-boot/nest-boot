import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { urlIdentifierSchema } from "../../common/utils/url-identifier.util.js";

/**
 * Input for creating a workspace.
 */
@InputType()
export class CreateWorkspaceInput {
  /** Workspace name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** Unique workspace URL slug. */
  @ZodField(() => urlIdentifierSchema)
  @Field(() => String)
  slug!: string;
}
