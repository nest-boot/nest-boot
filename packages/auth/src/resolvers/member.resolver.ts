import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import { BadRequestException } from "@nestjs/common";

import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { MemberType } from "../enums/member-type.enum.js";
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
   * @param memberService - Service for workspace memberships and service accounts.
   */
  constructor(
    /** Auth-owned workspace role and permission operations. */
    readonly memberService: MemberService,
  ) {}

  /**
   * Resolves the user associated with a workspace member.
   * @param member - The workspace membership to inspect or change.
   * @returns Matching user, or null if unavailable.
   */
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() member: Member): Promise<User | null> {
    return await this.memberService.getMemberUser(member);
  }

  /**
   * Lists configured workspace roles with the current principal's grant availability.
   * @returns Workspace role choices and whether each may be granted.
   */
  @Query(() => [WorkspaceRoleOption])
  workspaceRoles(): WorkspaceRoleOption[] {
    return this.memberService.listRoles();
  }

  /**
   * Lists configured workspace permissions with the current principal's grant availability.
   * @returns Workspace permission choices and whether each may be granted.
   */
  @Query(() => [WorkspacePermissionOption])
  workspacePermissions(): WorkspacePermissionOption[] {
    return this.memberService.listPermissions();
  }

  /**
   * Returns the workspace member selected for the current request.
   * @returns Current workspace member, or null when no member was resolved.
   */
  @Query(() => Member, { nullable: true })
  currentMember(): Member | null {
    return this.memberService.getCurrentMember();
  }

  /**
   * Returns a workspace member by ID.
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
   * @param workspace - Current workspace.
   * @param input - Input for adding a member.
   * @returns Newly created member identifier.
   */
  @Mutation(() => AddMemberPayload)
  async addMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args("input") input: AddMemberInput,
  ): Promise<AddMemberPayload> {
    if (input.type === MemberType.SERVICE_ACCOUNT) {
      if (!input.name || input.email !== undefined)
        throw new BadRequestException(
          "Service accounts require a name and cannot link a login email",
        );
      const member = await this.memberService.addServiceAccount(
        workspace,
        input.name,
        { roles: input.roles, permissions: input.permissions },
      );
      return { id: member.id };
    }
    if (!input.email)
      throw new BadRequestException("User members require an email");
    const member = await this.memberService.addMemberByEmail(
      workspace,
      input.email,
      { roles: input.roles, permissions: input.permissions },
    );
    return { id: member.id };
  }

  /**
   * Updates workspace member details.
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

  /**
   * Replaces roles assigned to a workspace member.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the member whose roles were replaced.
   */
  @Mutation(() => SetMemberRolesPayload)
  async setMemberRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberRolesInput,
  ): Promise<SetMemberRolesPayload> {
    const member = await this.memberService.setMemberRoles(id, input.roles);
    return { id: member.id };
  }

  /**
   * Replaces direct permissions assigned to a workspace member.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the member whose permissions were replaced.
   */
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
