import { Field, ObjectType } from "@nest-boot/graphql";

import { SystemApiKey } from "../entities/system-api-key.entity.js";
/** The new system credential and its plaintext returned once. */
@ObjectType({ isAbstract: true })
export class CreateSystemApiKeyResult {
  @Field(() => SystemApiKey)
  entity!: SystemApiKey;
  @Field(() => String)
  apiKey!: string;
}
