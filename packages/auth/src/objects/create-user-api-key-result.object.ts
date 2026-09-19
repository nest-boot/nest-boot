import { Field, ObjectType } from "@nest-boot/graphql";

import { UserApiKey } from "../entities/user-api-key.entity.js";

/**
 * Result returned to the client after creating an API key.
 */
@ObjectType()
export class CreateUserApiKeyResult {
  /** Created API key entity. */

  @Field(() => UserApiKey)
  entity!: UserApiKey;

  /** Plaintext API key, returned only once at creation. */
  @Field(() => String)
  apiKey!: string;
}
