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
import { WorkspacePermission } from "../enums/workspace-permission.enum.js";
import { WorkspaceRole } from "../enums/workspace-role.enum.js";
import { AddMemberInput } from "../inputs/add-member.input.js";
import { SetMemberPermissionsInput } from "../inputs/set-member-permissions.input.js";
import { SetMemberRolesInput } from "../inputs/set-member-roles.input.js";
import { UpdateMemberInput } from "../inputs/update-member.input.js";
import { RemoveMemberPayload } from "../objects/remove-member-payload.object.js";
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

  /** Lists configured workspace roles. */
  @Query(() => [WorkspaceRole])
  workspaceRoles(): string[] {
    return this.memberService.listRoles().map(({ name }) => name);
  }

  /** Lists roles the current principal may grant; mutations still authorize their targets. */
  @Query(() => [WorkspaceRole])
  workspaceAssignableRoles(): string[] {
    return this.memberService.listAssignableRoles().map(({ name }) => name);
  }

  /** Lists permissions available to workspace roles. */
  @Query(() => [WorkspacePermission])
  workspacePermissions(): string[] {
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
   * @returns Newly created workspace member.
   */
  @Mutation(() => Member)
  async addMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args("input") input: AddMemberInput,
  ): Promise<Member> {
    return await this.memberService.addMemberByEmail(workspace, input.email);
  }

  /**
   * Updates workspace member details.
   *
   * @param id - ID of the workspace member to update.
   * @param input - Member update input.
   * @returns Updated workspace member.
   */
  @Mutation(() => Member, { nullable: true })
  async updateMember(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateMemberInput,
  ): Promise<Member | null> {
    return await this.memberService.updateMember(id, input);
  }

  /** Replaces roles assigned to a non-owner workspace member. */
  @Mutation(() => Member)
  async setMemberRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberRolesInput,
  ): Promise<Member> {
    return await this.memberService.setMemberRoles(id, input.roles);
  }

  /** Replaces direct permissions assigned to a workspace member. */
  @Mutation(() => Member)
  async setMemberPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberPermissionsInput,
  ): Promise<Member> {
    return await this.memberService.setMemberPermissions(id, input.permissions);
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
