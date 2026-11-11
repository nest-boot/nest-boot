/* eslint-disable @nest-boot/graphql-field-config-from-types -- Dynamic enum values and ORM Opt markers require explicit metadata. */
import type { Opt } from "@mikro-orm/core";
import { Field, ObjectType } from "@nest-boot/graphql";

import { ApiKeyFields } from "../entities/api-key-fields.js";
import { ApiKeyPermission } from "../enums/api-key-permission.enum.js";

/** Public credential metadata shared by every owner kind. */
@ObjectType({ isAbstract: true })
export class ApiKey extends ApiKeyFields {
  /** Explicit stored grants; the owner-specific catalog controls delegation. */
  @Field(() => [ApiKeyPermission])
  declare permissions: Opt<string[]>;
}
