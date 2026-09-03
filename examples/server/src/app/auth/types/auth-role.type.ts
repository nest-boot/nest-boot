import { Field, ObjectType } from '@nest-boot/graphql';

/** A configured authorization role and the permissions it grants. */
@ObjectType()
export class AuthRoleType {
  /** Stable role name stored on identities and workspace members. */
  @Field(() => String)
  name!: string;

  /** Flattened permissions inherited by identities assigned this role. */
  @Field(() => [String])
  permissions!: string[];
}
