import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/**
 * Input for creating a workspace.
 */
@InputType()
export class CreateWorkspaceInput {
  /** Workspace name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;
}
