import { Field, ObjectType } from "@nest-boot/graphql";

import { UserApiKey } from "./user-api-key.object.js";
/** The new user credential and its plaintext returned once. */
@ObjectType({ isAbstract: true })
export class CreateUserApiKeyResult {
  @Field(() => UserApiKey)
  entity!: UserApiKey;
  @Field(() => String)
  apiKey!: string;
}
