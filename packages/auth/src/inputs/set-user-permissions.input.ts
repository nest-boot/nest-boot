import { Field, InputType } from "@nest-boot/graphql";
import { IsArray, IsString } from "class-validator";

/** Replaces application permissions on a user. */
@InputType()
export class SetUserPermissionsInput {
  /** Complete replacement permission list. */
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  permissions!: string[];
}
