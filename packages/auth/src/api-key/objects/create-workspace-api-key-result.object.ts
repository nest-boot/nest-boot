import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspaceApiKey } from "./workspace-api-key.object.js";
/** The new workspace credential and its plaintext returned once. */
@ObjectType({ isAbstract: true })
export class CreateWorkspaceApiKeyResult {
  @Field(() => WorkspaceApiKey)
  entity!: WorkspaceApiKey;
  @Field(() => String)
  apiKey!: string;
}
