import { Field, ObjectType } from "@nest-boot/graphql";

import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";

/**
 * Result returned to the client after creating an API key.
 */
@ObjectType()
export class CreateSystemAccountApiKeyResult {
  /** Created API key entity. */

  @Field(() => SystemAccountApiKey)
  entity!: SystemAccountApiKey;

  /** Plaintext API key, returned only once at creation. */
  @Field(() => String)
  apiKey!: string;
}
