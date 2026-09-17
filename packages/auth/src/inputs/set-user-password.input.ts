import { Field, InputType } from "@nest-boot/graphql";
import { IsString } from "class-validator";

/** Password replacement performed by an administrator. */
@InputType()
export class SetUserPasswordInput {
  /** Replacement credential password. */
  @IsString()
  @Field(() => String)
  password!: string;
}
