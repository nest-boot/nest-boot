import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { UserPermission } from "../enums/user-permission.enum.js";
import { UserRole } from "../enums/user-role.enum.js";

/** User created through the user-management API. */
@InputType()
export class CreateUserInput {
  /** Email address for the new user. */
  @ZodField((z) => z.email().max(255))
  @Field(() => String)
  email!: string;

  /** Display name for the new user. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** Initial credential password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;

  /** Initial application roles. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [UserRole], { nullable: true })
  roles?: UserRole[];

  /** Direct user-administration permissions. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [UserPermission], { nullable: true })
  permissions?: UserPermission[];
}
