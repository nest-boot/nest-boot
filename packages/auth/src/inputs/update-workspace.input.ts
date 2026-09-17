import { Field, InputType } from "@nest-boot/graphql";
import { IsOptional, IsString } from "class-validator";

/**
 * Input for updating a workspace.
 */
@InputType()
export class UpdateWorkspaceInput {
  /** New workspace name. */
  @IsString()
  @IsOptional()
  @Field(() => String, { nullable: true })
  name?: string;
}
