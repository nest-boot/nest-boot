import { Field, ID, InputType, Int } from "@nest-boot/graphql";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

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

/** Fields an administrator can update directly. */
@InputType()
export class UpdateUserInput {
  /** Replacement email address. */
  @IsOptional()
  @IsEmail()
  @Field(() => String, { nullable: true })
  email?: string;

  /** Whether the replacement email is verified. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  emailVerified?: boolean;

  /** Replacement display name. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string;

  /** Replacement avatar URL, or null to clear it. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string | null;
}

/** Replaces application permissions on a user. */
@InputType()
export class SetUserPermissionsInput {
  /** Complete replacement permission list. */
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  permissions!: string[];
}

/** Replaces application roles on a user. */
@InputType()
export class SetUserRolesInput {
  /** Complete replacement role list. */
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];
}

/** User-ban policy. */
@InputType()
export class BanUserInput {
  /** Optional reason recorded for the ban. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  reason?: string;

  /** Optional ban lifetime in seconds. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, { nullable: true })
  expiresIn?: number;
}

/** Password replacement performed by an administrator. */
@InputType()
export class SetUserPasswordInput {
  /** Replacement credential password. */
  @IsString()
  @Field(() => String)
  password!: string;
}

/** Identifier input shared by user-management operations. */
@InputType()
export class UserIdInput {
  /** User identifier. */
  @IsString()
  @Field(() => ID)
  id!: string;
}
