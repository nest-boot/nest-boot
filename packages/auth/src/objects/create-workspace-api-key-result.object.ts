import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";

/**
 * Result returned to the client after creating an API key.
 */
@ObjectType()
export class CreateWorkspaceApiKeyResult {
  /** Created API key entity. */

  @Field(() => WorkspaceApiKey)
  entity!: WorkspaceApiKey;

  /** Plaintext API key, returned only once at creation. */
  @Field(() => String)
  apiKey!: string;
}
