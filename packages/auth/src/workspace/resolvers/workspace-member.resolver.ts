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

import { filterPermissionValues } from "../../common/utils/filter-permission-values.util.js";
import { User } from "../../core/entities/user.entity.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../enums/workspace-member-type.enum.js";
import { WorkspacePermission } from "../enums/workspace-permission.enum.js";
import { AddWorkspaceMemberInput } from "../inputs/add-workspace-member.input.js";
import { SetWorkspaceMemberPermissionsInput } from "../inputs/set-workspace-member-permissions.input.js";
import { SetWorkspaceMemberRolesInput } from "../inputs/set-workspace-member-roles.input.js";
import { UpdateWorkspaceMemberInput } from "../inputs/update-workspace-member.input.js";
import { AddWorkspaceMemberPayload } from "../objects/add-workspace-member-payload.object.js";
import { RemoveWorkspaceMemberPayload } from "../objects/remove-workspace-member-payload.object.js";
import { SetWorkspaceMemberPermissionsPayload } from "../objects/set-workspace-member-permissions-payload.object.js";
import { SetWorkspaceMemberRolesPayload } from "../objects/set-workspace-member-roles-payload.object.js";
import { UpdateWorkspaceMemberPayload } from "../objects/update-workspace-member-payload.object.js";
import { WorkspacePermissionOption } from "../objects/workspace-permission-option.object.js";
import { WorkspaceRoleOption } from "../objects/workspace-role-option.object.js";
import { WorkspaceMemberService } from "../services/workspace-member.service.js";

/** Workspace membership API. */
@Resolver(() => WorkspaceMember)
export class WorkspaceMemberResolver {
  /**
   * Resolves grants supported by the current GraphQL permission catalog.
   * @param member - Identity or credential whose stored grants are being presented.
   * @returns Serializable permission values without mutating effective grants.
   */
  @ResolveField(() => [WorkspacePermission])
  permissions(@Parent() member: WorkspaceMember): WorkspacePermission[] {
    return filterPermissionValues(member.permissions, WorkspacePermission);
  }

  /**
   * Creates this resolver.
   * @param workspaceMemberService - Workspace member and service-account operations.
   */
  constructor(readonly workspaceMemberService: WorkspaceMemberService) {}

  /**
   * Resolves the user associated with a workspace member.
   * @param member - The workspace membership to inspect or change.
   * @returns Matching user, or null if unavailable.
   */
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() member: WorkspaceMember): Promise<User | null> {
    return await this.workspaceMemberService.getWorkspaceMemberUser(member);
  }

  /**
   * Lists configured workspace roles with the current principal's grant availability.
   * @returns Workspace role choices and whether each may be granted.
   */
  @Query(() => [WorkspaceRoleOption])
  workspaceRoles(): WorkspaceRoleOption[] {
    return this.workspaceMemberService.listRoles();
  }

  /**
   * Lists configured workspace permissions with the current principal's grant availability.
   * @returns Workspace permission choices and whether each may be granted.
   */
  @Query(() => [WorkspacePermissionOption])
  workspacePermissions(): WorkspacePermissionOption[] {
    return this.workspaceMemberService.listPermissions();
  }

  /**
   * Returns the workspace member selected for the current request.
   * @returns Current workspace member, or null when no member was resolved.
   */
  @Query(() => WorkspaceMember, { nullable: true })
  currentWorkspaceMember(): WorkspaceMember | null {
    return this.workspaceMemberService.getCurrentWorkspaceMember();
  }

  /**
   * Returns a workspace member by ID.
   * @param id - Workspace member ID.
   * @returns Matching workspace member, or null when not found.
   */
  @Query(() => WorkspaceMember, { nullable: true })
  async workspaceMember(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<WorkspaceMember | null> {
    return await this.workspaceMemberService.getWorkspaceMember(id);
  }

  /**
   * Adds an existing user to the workspace by email.
   * @param workspace - Current workspace.
   * @param input - Input for adding a member.
   * @returns Newly created member identifier.
   */
  @Mutation(() => AddWorkspaceMemberPayload)
  async addWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args("input") input: AddWorkspaceMemberInput,
  ): Promise<AddWorkspaceMemberPayload> {
    if (input.type === WorkspaceMemberType.SERVICE_ACCOUNT) {
      if (!input.name || input.email != null) {
        throw new BadRequestException(
          "Service accounts require a name and cannot link a login email",
        );
      }
      const member =
        await this.workspaceMemberService.addWorkspaceServiceAccount(
          workspace,
          input.name,
          { roles: input.roles, permissions: input.permissions },
        );
      return { id: member.id };
    }
    if (!input.email) {
      throw new BadRequestException("User members require an email");
    }
    const member = await this.workspaceMemberService.addWorkspaceMemberByEmail(
      workspace,
      input.email,
      { roles: input.roles, permissions: input.permissions },
    );
    return { id: member.id };
  }

  /**
   * Updates workspace member details.
   * @param id - ID of the workspace member to update.
   * @param input - WorkspaceMember update input.
   * @returns Updated member identifier.
   */
  @Mutation(() => UpdateWorkspaceMemberPayload, { nullable: true })
  async updateWorkspaceMember(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceMemberInput,
  ): Promise<UpdateWorkspaceMemberPayload | null> {
    const member = await this.workspaceMemberService.updateWorkspaceMember(
      id,
      input,
    );
    return member ? { id: member.id } : null;
  }

  /**
   * Replaces roles assigned to a workspace member.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the member whose roles were replaced.
   */
  @Mutation(() => SetWorkspaceMemberRolesPayload)
  async setWorkspaceMemberRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetWorkspaceMemberRolesInput,
  ): Promise<SetWorkspaceMemberRolesPayload> {
    const member = await this.workspaceMemberService.setWorkspaceMemberRoles(
      id,
      input.roles,
    );
    return { id: member.id };
  }

  /**
   * Replaces direct permissions assigned to a workspace member.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the member whose permissions were replaced.
   */
  @Mutation(() => SetWorkspaceMemberPermissionsPayload)
  async setWorkspaceMemberPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetWorkspaceMemberPermissionsInput,
  ): Promise<SetWorkspaceMemberPermissionsPayload> {
    const member =
      await this.workspaceMemberService.setWorkspaceMemberPermissions(
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
  @Mutation(() => RemoveWorkspaceMemberPayload)
  async removeWorkspaceMember(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<RemoveWorkspaceMemberPayload> {
    const member = await this.workspaceMemberService.removeWorkspaceMember(id);
    return { id: member.id };
  }
}
