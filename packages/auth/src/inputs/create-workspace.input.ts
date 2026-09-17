import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/**
 * Input for creating a workspace.
 */
@InputType()
export class CreateWorkspaceInput {
  /** Workspace name. */
  @ZodField((z) => z.string())
  @Field(() => String)
  name!: string;
}
