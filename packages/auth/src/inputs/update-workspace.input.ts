import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/**
 * Input for updating a workspace.
 */
@InputType()
export class UpdateWorkspaceInput {
  /** New workspace name. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  name?: string;
}
