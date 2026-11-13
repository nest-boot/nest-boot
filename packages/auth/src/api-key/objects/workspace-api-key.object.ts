/* eslint-disable @nest-boot/graphql-field-config-from-types -- Permission enums are populated from runtime catalogs. */
import { type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { WorkspaceApiKeyPermission } from "../enums/workspace-api-key-permission.enum.js";
import { ApiKeyObject } from "./api-key.object.js";

/** WorkspaceMember-key authorization view of a credential persisted as ApiKey. */
@ObjectType({ isAbstract: true })
export class WorkspaceApiKey extends ApiKeyObject {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): "workspace_member" {
    return "workspace_member";
  }

  /** Concrete owning identity for this public credential view. */
  @HideField()
  declare owner: Ref<WorkspaceMember>;

  /**
   * Reference to the owning member.
   * @returns Required owner reference for this credential kind.
   */
  override get member(): Ref<WorkspaceMember> {
    return this.owner;
  }
  override set member(
    owner: Ref<WorkspaceMember> | WorkspaceMember | undefined,
  ) {
    super.member = owner;
  }

  /** Operations allowed by this credential. */
  @Field(() => [WorkspaceApiKeyPermission])
  declare permissions: string[];
}
