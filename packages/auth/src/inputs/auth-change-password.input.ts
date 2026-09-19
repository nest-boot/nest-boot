import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Current-user password change input. */
@InputType()
export class AuthChangePasswordInput {
  /** Current password used to authorize the change. */
  @ZodField((z) => z.string())
  @Field(() => String)
  currentPassword!: string;

  /** Replacement password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  newPassword!: string;

  /** Whether other sessions should be revoked. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  revokeOtherSessions?: boolean;
}
