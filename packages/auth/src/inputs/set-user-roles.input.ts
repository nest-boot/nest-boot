import { Field, InputType } from "@nest-boot/graphql";
import { IsArray, IsString } from "class-validator";

/** Replaces application roles on a user. */
@InputType()
export class SetUserRolesInput {
  /** Complete replacement role list. */
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];
}
