import { Field, InputType } from "@nest-boot/graphql";
import { IsArray, IsEmail, IsOptional, IsString } from "class-validator";

/** User created through the user-management API. */
@InputType()
export class CreateUserInput {
  /** Email address for the new user. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Display name for the new user. */
  @IsString()
  @Field(() => String)
  name!: string;

  /** Initial credential password. */
  @IsString()
  @Field(() => String)
  password!: string;

  /** Initial application roles. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  roles?: string[];

  /** Direct user-administration permissions. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[];
}
