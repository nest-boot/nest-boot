import { Field, InputType } from "@nest-boot/graphql";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { MemberStatus } from "../enums/member-status.enum.js";

/** Input for updating a workspace member. */
@InputType()
export class UpdateMemberInput {
  /** Workspace-visible member name; does not update the user's profile. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;

  /** Workspace-visible contact email; does not change the login email. Null clears it. */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  email?: string | null;

  /** Member status. */
  @IsOptional()
  @IsIn(Object.values(MemberStatus), {
    message: "Status must be a valid member status",
  })
  @Field(() => MemberStatus, { nullable: true })
  status?: MemberStatus;
}
