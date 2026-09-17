import { Field, ObjectType } from "@nest-boot/graphql";

import { ApiKey } from "../entities/api-key.entity.js";

/**
 * Result returned to the client after creating an API key.
 */
@ObjectType()
export class CreateApiKeyResult {
  /** Created API key entity. */

  @Field(() => ApiKey)
  entity!: ApiKey;

  /** Plaintext API key, returned only once at creation. */
  @Field(() => String)
  apiKey!: string;
}
