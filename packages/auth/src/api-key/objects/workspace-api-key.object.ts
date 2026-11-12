/* eslint-disable @nest-boot/graphql-field-config-from-types -- Permission enums are populated from runtime catalogs. */
import { type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { Member } from "../../workspace/entities/member.entity.js";
import { WorkspaceApiKeyPermission } from "../enums/workspace-api-key-permission.enum.js";
import { ApiKeyObject } from "./api-key.object.js";

/** Member-key authorization view of a credential persisted as ApiKey. */
@ObjectType({ isAbstract: true })
export class WorkspaceApiKey extends ApiKeyObject {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): "member" {
    return "member";
  }

  /** Concrete owning identity for this public credential view. */
  @HideField()
  declare owner: Ref<Member>;

  /**
   * Reference to the owning member.
   * @returns Required owner reference for this credential kind.
   */
  override get member(): Ref<Member> {
    return this.owner;
  }
  override set member(owner: Ref<Member> | Member | undefined) {
    super.member = owner;
  }

  /** Operations allowed by this credential. */
  @Field(() => [WorkspaceApiKeyPermission])
  declare permissions: string[];
}
