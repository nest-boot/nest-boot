import { Field, ObjectType } from "@nest-boot/graphql";

import { ApiKey } from "./api-key.object.js";

/** Credential metadata and the plaintext revealed only when the key is issued. */
@ObjectType({ isAbstract: true })
export class CreateApiKeyResult {
  /** Created credential metadata. */
  @Field(() => ApiKey)
  entity!: ApiKey;

  /** Plaintext secret; never returned by metadata queries. */
  @Field(() => String)
  apiKey!: string;
}
