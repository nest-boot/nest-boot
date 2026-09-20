import { Field, Int, ObjectType } from "@nest-boot/graphql";

/** Public password length policy used by credential forms. */
@ObjectType()
export class PasswordPolicy {
  /** Minimum length accepted for a new password. */
  @Field(() => Int)
  minLength!: number;

  /** Maximum length accepted for a new password. */
  @Field(() => Int)
  maxLength!: number;
}
