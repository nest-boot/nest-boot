import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";

import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AddMemberInput } from "../inputs/add-member.input.js";
import { SetMemberPermissionsInput } from "../inputs/set-member-permissions.input.js";
import { SetMemberRolesInput } from "../inputs/set-member-roles.input.js";
import { UpdateMemberInput } from "../inputs/update-member.input.js";
import { AddMemberPayload } from "../objects/add-member-payload.object.js";
import { RemoveMemberPayload } from "../objects/remove-member-payload.object.js";
import { SetMemberPermissionsPayload } from "../objects/set-member-permissions-payload.object.js";
import { SetMemberRolesPayload } from "../objects/set-member-roles-payload.object.js";
import { UpdateMemberPayload } from "../objects/update-member-payload.object.js";
import { WorkspacePermissionOption } from "../objects/workspace-permission-option.object.js";
import { WorkspaceRoleOption } from "../objects/workspace-role-option.object.js";
import { MemberService } from "../services/member.service.js";

/** GraphQL resolver for workspace members. */
@Resolver(() => Member)
export class MemberResolver {
  /**
   * Creates the workspace member resolver.
   *
   */
  constructor(
    /** Auth-owned workspace role and permission operations. */
    readonly memberService: MemberService,
  ) {}

  /** Resolves the user associated with a workspace member. */
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() member: Member): Promise<User | null> {
    return await this.memberService.getMemberUser(member);
  }

  /** Lists configured workspace roles with the current principal's grant availability. */
  @Query(() => [WorkspaceRoleOption])
  workspaceRoles(): WorkspaceRoleOption[] {
    return this.memberService.listRoles();
  }

  /** Lists configured workspace permissions with the current principal's grant availability. */
  @Query(() => [WorkspacePermissionOption])
  workspacePermissions(): WorkspacePermissionOption[] {
    return this.memberService.listPermissions();
  }

  /**
   * Returns the workspace member selected for the current request.
   *
   * @returns Current workspace member, or null when no member was resolved.
   */
  @Query(() => Member, { nullable: true })
  currentMember(): Member | null {
    return this.memberService.getCurrentMember();
  }

  /**
   * Returns a workspace member by ID.
   *
   * @param id - Workspace member ID.
   * @returns Matching workspace member, or null when not found.
   */
  @Query(() => Member, { nullable: true })
  async member(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Member | null> {
    return await this.memberService.getMember(id);
  }

  /**
   * Adds an existing user to the workspace by email.
   *
   * @param workspace - Current workspace.
   * @param input - Input for adding a member.
   * @returns Newly created member identifier.
   */
  @Mutation(() => AddMemberPayload)
  async addMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args("input") input: AddMemberInput,
  ): Promise<AddMemberPayload> {
    const member = await this.memberService.addMemberByEmail(
      workspace,
      input.email,
    );
    return { id: member.id };
  }

  /**
   * Updates workspace member details.
   *
   * @param id - ID of the workspace member to update.
   * @param input - Member update input.
   * @returns Updated member identifier.
   */
  @Mutation(() => UpdateMemberPayload, { nullable: true })
  async updateMember(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateMemberInput,
  ): Promise<UpdateMemberPayload | null> {
    const member = await this.memberService.updateMember(id, input);
    return member ? { id: member.id } : null;
  }

  /** Replaces roles assigned to a workspace member. */
  @Mutation(() => SetMemberRolesPayload)
  async setMemberRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberRolesInput,
  ): Promise<SetMemberRolesPayload> {
    const member = await this.memberService.setMemberRoles(id, input.roles);
    return { id: member.id };
  }

  /** Replaces direct permissions assigned to a workspace member. */
  @Mutation(() => SetMemberPermissionsPayload)
  async setMemberPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberPermissionsInput,
  ): Promise<SetMemberPermissionsPayload> {
    const member = await this.memberService.setMemberPermissions(
      id,
      input.permissions,
    );
    return { id: member.id };
  }

  /**
   * Removes a workspace member.
   *
   * @param id - ID of the workspace member to remove.
   * @returns Identifier of the removed workspace member.
   */
  @Mutation(() => RemoveMemberPayload)
  async removeMember(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<RemoveMemberPayload> {
    const member = await this.memberService.removeMember(id);
    return { id: member.id };
  }
}
