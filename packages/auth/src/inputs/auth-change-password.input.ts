import { Field, InputType } from "@nest-boot/graphql";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/** Current-user password change input. */
@InputType()
export class AuthChangePasswordInput {
  /** Current password used to authorize the change. */
  @IsString()
  @Field(() => String)
  currentPassword!: string;

  /** Replacement password. */
  @IsString()
  @Field(() => String)
  newPassword!: string;

  /** Whether other sessions should be revoked. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  revokeOtherSessions?: boolean;
}
