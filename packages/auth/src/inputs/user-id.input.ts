import { Field, ID, InputType } from "@nest-boot/graphql";
import { IsString } from "class-validator";

/** Identifier input shared by user-management operations. */
@InputType()
export class UserIdInput {
  /** User identifier. */
  @IsString()
  @Field(() => ID)
  id!: string;
}
