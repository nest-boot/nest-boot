import { Field, ObjectType } from "@nest-boot/graphql";

import { MemberApiKey } from "../entities/member-api-key.entity.js";

/**
 * Result returned to the client after creating an API key.
 */
@ObjectType()
export class CreateMemberApiKeyResult {
  /** Created API key entity. */

  @Field(() => MemberApiKey)
  entity!: MemberApiKey;

  /** Plaintext API key, returned only once at creation. */
  @Field(() => String)
  apiKey!: string;
}
