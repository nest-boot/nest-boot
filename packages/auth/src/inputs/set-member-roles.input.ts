import { Field, InputType } from "@nest-boot/graphql";
import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

/** Replaces the roles assigned to a workspace member. */
@InputType()
export class SetMemberRolesInput {
  /** Complete replacement role list; ownership uses the transfer flow. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];
}
