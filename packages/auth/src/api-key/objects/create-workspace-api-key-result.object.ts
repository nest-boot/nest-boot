import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
/** The new workspace credential and its plaintext returned once. */
@ObjectType({ isAbstract: true })
export class CreateWorkspaceApiKeyResult {
  @Field(() => WorkspaceApiKey)
  entity!: WorkspaceApiKey;
  @Field(() => String)
  apiKey!: string;
}
