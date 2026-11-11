/* eslint-disable @nest-boot/graphql-field-config-from-types -- Runtime permission catalogs require explicit enum metadata. */
import { type Opt, type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { Member } from "../../workspace/entities/member.entity.js";
import { WorkspaceApiKeyPermission } from "../enums/workspace-api-key-permission.enum.js";
import { ApiKeyFields } from "./api-key-fields.js";

/** Member-key authorization view of a credential persisted as ApiKey. */
@ObjectType({ isAbstract: true })
export class WorkspaceApiKey extends ApiKeyFields {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): Opt<"user" | "member" | "system_account"> {
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
  declare permissions: Opt<string[]>;

  /**
   * Member identifier available to management clients.
   * @returns Identifier of the member owning the credential.
   */
  override get memberId(): Opt<string> {
    return super.memberId;
  }

  /**
   * Workspace identifier available to management clients and abilities.
   * @returns Identifier of the owning member’s workspace.
   */
  override get workspaceId(): Opt<string> {
    return super.workspaceId;
  }
}
