import { Field, InputType } from "@nest-boot/graphql";
import { IsString } from "class-validator";

/**
 * Input for creating a workspace.
 */
@InputType()
export class CreateWorkspaceInput {
  /** Workspace name. */
  @IsString()
  @Field(() => String)
  name!: string;
}
