import { subject } from "@casl/ability";
import {
  EntityManager,
  type FilterObject,
  LockMode,
  Reference,
  TransactionPropagation,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { authorize } from "../../common/utils/authorize.util.js";
import { can } from "../../common/utils/can.util.js";
import {
  assertCanGrantPermissions,
  canGrantPermissions,
} from "../../common/utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../../common/utils/resolve-auth-catalog.util.js";
import {
  resolveRolePermissions,
  resolveWorkspaceMemberPermissions,
} from "../../common/utils/resolve-effective-permissions.util.js";
import { runAuthQuery } from "../../common/utils/run-auth-query.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import { AuthContext } from "../../core/auth-context.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import type { AuthModuleRoles } from "../../core/types/auth-module-roles.type.js";
import {
  assertCurrentWorkspace,
  assertCurrentWorkspaceMember,
  assertUserSession,
} from "../../core/utils/assert-current-identity.util.js";
import {
  listAuthPermissions,
  normalizeAuthPermissions,
  normalizeAuthRoles,
} from "../../core/utils/auth-role.util.js";
import { WorkspaceMemberConnection } from "../connections/workspace-member.connection-definition.js";
import { DEFAULT_WORKSPACE_ROLE } from "../constants/workspace.constants.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../enums/workspace-member-type.enum.js";
import type { AddWorkspaceMemberOptions } from "../interfaces/add-workspace-member-options.interface.js";
import type { UpdateWorkspaceMemberOptions } from "../interfaces/update-workspace-member-options.interface.js";
import type { WorkspaceHasPermissionsOptions } from "../interfaces/workspace-has-permissions-options.interface.js";
import type { WorkspacePermissionOption } from "../objects/workspace-permission-option.object.js";
import type { WorkspaceRoleOption } from "../objects/workspace-role-option.object.js";
import { getCurrentWorkspaceMember } from "../utils/get-current-workspace-member.util.js";

/** Workspace membership queries, profile management, and authorization. */
@Injectable()
export class WorkspaceMemberService {
  /**
   * Creates a workspace member domain service.
   * @param em - Entity manager used for persistence.
   * @param authOptions - Authentication module configuration.
   * @param authContext - Current request authentication context.
   */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly authContext: AuthContext,
  ) {}

  /**
   * Returns the current member after membership and instance read checks.
   * @returns Active member in the selected workspace, or null if unavailable.
   */
  getCurrentWorkspaceMember(): WorkspaceMember | null {
    const member = getCurrentWorkspaceMember();
    if (member) {
      authorize("read", member);
    }
    return member;
  }

  /**
   * Authorizes member pagination and scopes it to the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @returns Filter restricted to the workspace and readable member types.
   */
  getWorkspaceMemberListFilter(
    workspace: Workspace,
  ): FilterObject<WorkspaceMember> {
    assertCurrentWorkspace(workspace);
    authorize("read", WorkspaceMember);
    const types = Object.values(WorkspaceMemberType).filter((type) =>
      can(
        "read",
        subject("WorkspaceMember", { workspaceId: workspace.id, type }),
      ),
    );
    return types.length === Object.values(WorkspaceMemberType).length
      ? { workspace }
      : { workspace, type: { $in: types } };
  }

  /**
   * Paginates members within the selected workspace and its RLS scope.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated members visible to the current principal.
   */
  async getWorkspaceMemberConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<WorkspaceMember>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<WorkspaceMember>> {
    const where = this.getWorkspaceMemberListFilter(workspace);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<WorkspaceMember>(WorkspaceMemberConnection, args, {
      where,
      ...(info && { info }),
    });
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return connection;
  }

  /**
   * Finds the active membership linking a user and workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param user - The user whose account is being accessed.
   * @returns Matching membership, or null if the user is not a member.
   */
  async getWorkspaceMemberByUser(
    workspace: Workspace,
    user: User,
  ): Promise<WorkspaceMember | null> {
    assertUserSession(user);
    const member = await this.em.findOne(WorkspaceMember, {
      status: "ACTIVE",
      user,
      workspace,
    });
    return member;
  }

  /**
   * Finds a member by identifier within the request's selected workspace.
   * @param id - Identifier of the record to access.
   * @returns Authorized membership in the selected workspace.
   */
  async getWorkspaceMember(id: string): Promise<WorkspaceMember | null> {
    const workspace = RequestContext.isActive()
      ? RequestContext.get(Workspace)
      : undefined;
    if (!workspace) {
      throw new ForbiddenException("A workspace must be selected");
    }
    const where = this.getWorkspaceMemberListFilter(workspace);
    const member = await this.em.findOne(WorkspaceMember, { ...where, id });
    if (member) {
      authorize("read", member);
    }
    return member;
  }

  /**
   * Resolves a member's user with workspace authorization and request RLS.
   * @param member - The workspace membership to inspect or change.
   * @returns User associated with the membership, or null for a service account.
   */
  async getWorkspaceMemberUser(member: WorkspaceMember): Promise<User | null> {
    if (member.type === "SERVICE_ACCOUNT") {
      return null;
    }
    const workspace = this.unwrapWorkspace(member);
    const actor = RequestContext.isActive() ? RequestContext.get(User) : null;
    const actorId = actor?.id;
    const ownWorkspaceMember =
      !getCurrentApiKey() &&
      actorId !== undefined &&
      member.user?.id === actorId;
    if (!ownWorkspaceMember) {
      assertCurrentWorkspace(workspace);
      authorize("read", User);
    }
    const current = await this.em.findOne(
      WorkspaceMember,
      {
        id: member.id,
        workspace,
        ...(ownWorkspaceMember ? { user: actorId } : {}),
      },
      { refresh: true },
    );
    if (!current?.user?.id) {
      return null;
    }
    const user = await this.em.findOne(
      User,
      { id: current.user.id },
      { refresh: true },
    );
    if (user && !ownWorkspaceMember) {
      authorize("read", user);
    }
    return user;
  }

  /**
   * Adds an existing user to a workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param user - The user whose account is being accessed.
   * @param input - Requested field values for the operation.
   * @returns Created workspace membership.
   */
  async addWorkspaceMember(
    workspace: Workspace,
    user: User,
    input: AddWorkspaceMemberOptions = {},
  ): Promise<WorkspaceMember> {
    assertCurrentWorkspace(workspace);
    authorize(
      "write",
      subject("WorkspaceMember", {
        workspaceId: workspace.id,
        type: WorkspaceMemberType.USER,
      }),
    );
    const permissions = this.normalizePermissions(input.permissions ?? []);
    assertCanGrantPermissions(this.authOptions, "workspace", permissions);
    const roles = this.normalizeGrantedRoles(input.roles ?? [this.defaultRole]);
    return await this.em.transactional(
      async (em) => {
        await this.lockWorkspace(em, workspace);
        const existing = await em.findOne(
          WorkspaceMember,
          { user, workspace },
          { filters: false },
        );
        if (existing) {
          throw new ConflictException("User is already a member");
        }
        const member = em.create(WorkspaceMember, {
          name: user.name,
          email: user.email.trim().toLowerCase(),
          permissions,
          roles,
          status: "ACTIVE",
          user,
          workspace,
        });
        authorize("write", member);
        await em.persist(member).flush();
        await em.nativeUpdate(
          WorkspaceInvitation,
          {
            email: user.email.trim().toLowerCase(),
            status: "pending",
            workspace,
          },
          { status: "canceled" },
        );
        return member;
      },
      { clear: true },
    );
  }

  /**
   * Adds a service account without creating a login user.
   * @param workspace - The workspace that scopes this operation.
   * @param name - Name used to identify the resource.
   * @param input - Requested field values for the operation.
   * @returns Created service account membership.
   */
  async addWorkspaceServiceAccount(
    workspace: Workspace,
    name: string,
    input: AddWorkspaceMemberOptions = {},
  ): Promise<WorkspaceMember> {
    assertCurrentWorkspace(workspace);
    authorize(
      "write",
      subject("WorkspaceMember", {
        workspaceId: workspace.id,
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
      }),
    );
    if (!name.trim() || name.trim().length > 255) {
      throw new BadRequestException(
        "A service account name is required (maximum 255 characters)",
      );
    }
    const permissions = this.normalizePermissions(input.permissions ?? []);
    assertCanGrantPermissions(this.authOptions, "workspace", permissions);
    const roles =
      input.roles?.length === 0
        ? []
        : this.normalizeGrantedRoles(input.roles ?? [this.defaultRole]);
    return await this.em.transactional(
      async (em) => {
        await this.lockWorkspace(em, workspace);
        const member = em.create(WorkspaceMember, {
          name: name.trim(),
          type: WorkspaceMemberType.SERVICE_ACCOUNT,
          user: null,
          email: null,
          roles,
          permissions,
          status: "ACTIVE",
          workspace,
        });
        authorize("write", member);
        await em.persist(member).flush();
        return member;
      },
      { clear: true, propagation: TransactionPropagation.REQUIRED },
    );
  }

  /**
   * Adds an existing user to a workspace by normalized email address.
   * @param workspace - The workspace that scopes this operation.
   * @param email - Email address used to identify the user.
   * @param input - Requested field values for the operation.
   * @returns WorkspaceMembership created for the user with the supplied email.
   */
  async addWorkspaceMemberByEmail(
    workspace: Workspace,
    email: string,
    input: AddWorkspaceMemberOptions = {},
  ): Promise<WorkspaceMember> {
    assertCurrentWorkspace(workspace);
    authorize(
      "write",
      subject("WorkspaceMember", {
        workspaceId: workspace.id,
        type: WorkspaceMemberType.USER,
      }),
    );
    const user = await this.getUserForWorkspaceMembership(workspace, email);

    return await this.addWorkspaceMember(workspace, user, input);
  }

  /**
   * Looks up a user for explicitly authorized membership creation.
   * Infrastructure isolates this lookup; membership writes retain request RLS.
   * @param workspace - The workspace that scopes this operation.
   * @param email - Email address used to identify the user.
   * @returns User resolved for membership creation.
   * @internal
   */
  async getUserForWorkspaceMembership(
    workspace: Workspace,
    email: string,
  ): Promise<User> {
    return await runAuthQuery(this.em, async (em) => {
      assertCurrentWorkspace(workspace);
      authorize(
        "write",
        subject("WorkspaceMember", {
          workspaceId: workspace.id,
          type: WorkspaceMemberType.USER,
        }),
      );
      const user = await em.findOne(
        User,
        { email: email.trim().toLowerCase() },
        { filters: false },
      );
      if (!user) {
        throw new NotFoundException("User not found");
      }
      return user;
    });
  }

  private async resolveWorkspaceMemberForAction(
    member: WorkspaceMember | string,
    action: string,
  ): Promise<WorkspaceMember> {
    if (typeof member !== "string") {
      return member;
    }
    authorize(action, WorkspaceMember);
    const entity = await this.em.findOne(
      WorkspaceMember,
      { id: member },
      { populate: ["workspace"], refresh: true },
    );
    if (!entity) {
      throw new NotFoundException("Workspace member not found");
    }
    return entity;
  }

  /**
   * Updates workspace-visible member profile fields and active state.
   * @param member - The workspace membership to inspect or change.
   * @param input - Requested field values for the operation.
   * @returns WorkspaceMembership after the requested profile changes.
   */
  async updateWorkspaceMember(
    member: WorkspaceMember | string,
    input: UpdateWorkspaceMemberOptions,
  ): Promise<WorkspaceMember> {
    member = await this.resolveWorkspaceMemberForAction(member, "write");
    const workspace = this.unwrapWorkspace(member);
    assertCurrentWorkspace(workspace);
    authorize("write", member);
    if ("roles" in input || "permissions" in input) {
      throw new BadRequestException(
        "Use setWorkspaceMemberRoles or setWorkspaceMemberPermissions to update authorization fields",
      );
    }
    if (
      input.name !== undefined &&
      (typeof input.name !== "string" || !input.name.trim())
    ) {
      throw new BadRequestException("WorkspaceMember name must not be empty");
    }
    const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
    const email =
      input.email === undefined
        ? undefined
        : normalizedEmail === ""
          ? null
          : normalizedEmail;
    const changes = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    const assertCanUpdateFields = (target: WorkspaceMember) => {
      for (const field of Object.keys(changes)) {
        authorize("write", target, field);
      }
    };
    assertCanUpdateFields(member);
    this.assertAuthorizationCanCommit(member);
    const updated = await this.em.transactional(
      async (em) => {
        const lockedWorkspaceMember = await em.findOne(
          WorkspaceMember,
          { id: member.id, workspace },
          {
            lockMode: LockMode.PESSIMISTIC_WRITE,
            refresh: true,
          },
        );
        if (!lockedWorkspaceMember) {
          throw new NotFoundException("Workspace member not found");
        }
        authorize("write", lockedWorkspaceMember);
        assertCanUpdateFields(lockedWorkspaceMember);
        em.assign(lockedWorkspaceMember, changes);
        await em.flush();
        return lockedWorkspaceMember;
      },
      { clear: true },
    );
    this.syncCurrentMember(updated);
    return updated;
  }

  /**
   * Replaces a workspace member's roles within the caller's permission scope.
   * @param member - The workspace membership to inspect or change.
   * @param roleNames - Role names to validate.
   * @returns WorkspaceMembership after its assigned roles are replaced.
   */
  async setWorkspaceMemberRoles(
    member: WorkspaceMember | string,
    roleNames: string | readonly string[],
  ): Promise<WorkspaceMember> {
    member = await this.resolveWorkspaceMemberForAction(member, "set-roles");
    const workspace = this.unwrapWorkspace(member);
    assertCurrentWorkspace(workspace);
    authorize("set-roles", member);
    const roles = this.normalizeGrantedRoles(roleNames);

    this.assertAuthorizationCanCommit(member);
    const updated = await this.em.transactional(
      async (em) => {
        const lockedWorkspaceMember = await em.findOne(
          WorkspaceMember,
          { id: member.id, workspace },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!lockedWorkspaceMember) {
          throw new NotFoundException("Workspace member not found");
        }
        authorize("set-roles", lockedWorkspaceMember);

        lockedWorkspaceMember.roles = roles;
        await em.flush();
        return lockedWorkspaceMember;
      },
      { clear: true },
    );
    this.syncCurrentMember(updated);
    return updated;
  }

  /**
   * Replaces direct permissions assigned to a workspace member.
   * @param member - The workspace membership to inspect or change.
   * @param permissions - Permission names to apply.
   * @returns WorkspaceMembership after its direct permissions are replaced.
   */
  async setWorkspaceMemberPermissions(
    member: WorkspaceMember | string,
    permissions: readonly string[],
  ): Promise<WorkspaceMember> {
    member = await this.resolveWorkspaceMemberForAction(
      member,
      "set-permissions",
    );
    const workspace = this.unwrapWorkspace(member);
    assertCurrentWorkspace(workspace);
    authorize("set-permissions", member);
    const normalizedPermissions = this.normalizePermissions(permissions);
    assertCanGrantPermissions(
      this.authOptions,
      "workspace",
      normalizedPermissions,
    );
    this.assertAuthorizationCanCommit(member);
    const updated = await this.em.transactional(
      async (em) => {
        const lockedWorkspaceMember = await em.findOne(
          WorkspaceMember,
          { id: member.id, workspace },
          {
            lockMode: LockMode.PESSIMISTIC_WRITE,
            refresh: true,
          },
        );
        if (!lockedWorkspaceMember) {
          throw new NotFoundException("Workspace member not found");
        }
        authorize("set-permissions", lockedWorkspaceMember);
        lockedWorkspaceMember.permissions = normalizedPermissions;
        await em.flush();
        return lockedWorkspaceMember;
      },
      { clear: true },
    );
    this.syncCurrentMember(updated);
    return updated;
  }

  private isCurrentWorkspaceMember(member: WorkspaceMember): boolean {
    const current = RequestContext.isActive()
      ? RequestContext.get(WorkspaceMember)
      : null;
    return !!current && current.id === member.id;
  }

  /**
   * Removes a member after checking write ability; self-removal uses leaveWorkspace.
   * @param member - The workspace membership to inspect or change.
   * @returns Removed membership.
   */
  async removeWorkspaceMember(
    member: WorkspaceMember | string,
  ): Promise<WorkspaceMember> {
    member = await this.resolveWorkspaceMemberForAction(member, "write");
    const workspace = this.unwrapWorkspace(member);
    assertCurrentWorkspace(workspace);
    authorize("write", member);
    if (this.isCurrentWorkspaceMember(member)) {
      throw new ForbiddenException("You are not allowed to remove yourself");
    }
    return await this.removeWorkspaceMemberRecord(
      workspace,
      member,
      (lockedWorkspaceMember) => {
        authorize("write", lockedWorkspaceMember);
      },
    );
  }

  /**
   * Lets the current member leave its workspace regardless of role.
   * @param member - The workspace membership to inspect or change.
   * @returns WorkspaceMembership removed from the current user's workspace.
   */
  async leaveWorkspace(member: WorkspaceMember): Promise<WorkspaceMember> {
    assertCurrentWorkspaceMember(member);
    const user = RequestContext.get(User);
    if (!user) {
      throw new ForbiddenException("A user identity is required");
    }
    assertUserSession(user);
    if (member.user?.id !== user.id) {
      throw new ForbiddenException("The membership belongs to another user");
    }
    const workspace = this.unwrapWorkspace(member);
    assertCurrentWorkspace(workspace);
    // Session context can only be restaged after the removal's top-level commit.
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Leave the workspace outside an active transaction",
      );
    }
    const removed = await this.removeWorkspaceMemberRecord(
      workspace,
      member,
      (lockedWorkspaceMember) => {
        assertCurrentWorkspaceMember(lockedWorkspaceMember);
      },
    );
    this.authContext.clearWorkspace();
    return removed;
  }

  /**
   * Checks flattened `subject:action` values against member permissions.
   * @param member - The workspace membership to inspect or change.
   * @param input - Requested field values for the operation.
   * @returns Whether every requested permission is effective for the principal.
   */
  hasPermissions(
    member: WorkspaceMember,
    input: WorkspaceHasPermissionsOptions,
  ): boolean {
    const permissions = new Set(
      this.getEffectiveWorkspaceMemberPermissions(member),
    );
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) => permissions.has(`${subject}:${action}`)),
    );
  }

  /**
   * Lists all roles with grant availability; mutations still authorize their targets.
   * @returns Role choices and whether each is within the caller's grant ceiling.
   */
  listRoles(): WorkspaceRoleOption[] {
    const canAssign =
      can("write", WorkspaceInvitation) || can("set-roles", WorkspaceMember);
    if (!canAssign) {
      authorize("read", WorkspaceMember);
    }
    return Object.keys(this.roles).map((role) => ({
      role,
      grantable:
        canAssign &&
        canGrantPermissions(
          this.authOptions,
          "workspace",
          resolveRolePermissions(this.authOptions, "workspace", [role]),
        ),
    }));
  }

  /**
   * Lists all direct-permission options without authorizing a particular member.
   * @returns Permission choices and whether each is within the caller's grant ceiling.
   */
  listPermissions(): WorkspacePermissionOption[] {
    const canAssign = can("set-permissions", WorkspaceMember);
    if (!canAssign) {
      authorize("read", WorkspaceMember);
    }
    return listAuthPermissions(this.permissions).map((permission) => ({
      permission,
      grantable:
        canAssign &&
        canGrantPermissions(this.authOptions, "workspace", [permission]),
    }));
  }

  /**
   * Resolves permissions inherited from roles plus direct member permissions.
   * @param member - The workspace membership to inspect or change.
   * @returns Union of the member's role permissions and direct permissions.
   */
  getEffectiveWorkspaceMemberPermissions(member: WorkspaceMember): string[] {
    return resolveWorkspaceMemberPermissions(this.authOptions, member);
  }

  private async lockWorkspace(
    em: EntityManager,
    workspace: Workspace,
  ): Promise<void> {
    await em.refreshOrFail(workspace, {
      filters: false,
      lockMode: LockMode.PESSIMISTIC_WRITE,
      populate: [],
      failHandler: () => new NotFoundException("Workspace not found"),
    });
  }

  private normalizeRoles(role: string | readonly string[]): string[] {
    return normalizeAuthRoles(role, this.roles);
  }

  private normalizeGrantedRoles(role: string | readonly string[]): string[] {
    const roles = this.normalizeRoles(role);
    assertCanGrantPermissions(
      this.authOptions,
      "workspace",
      resolveRolePermissions(this.authOptions, "workspace", roles),
    );
    return roles;
  }

  private normalizePermissions(permissions: readonly string[]): string[] {
    return normalizeAuthPermissions(
      permissions,
      this.permissions,
      "Workspace member",
    );
  }

  private async removeWorkspaceMemberRecord(
    workspace: Workspace,
    member: WorkspaceMember,
    assertAccess: (member: WorkspaceMember) => void,
  ): Promise<WorkspaceMember> {
    return await this.em.transactional(
      async (em) => {
        const lockedWorkspaceMember = await em.findOne(
          WorkspaceMember,
          { id: member.id, workspace },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!lockedWorkspaceMember) {
          throw new NotFoundException("Workspace member not found");
        }
        assertAccess(lockedWorkspaceMember);

        await em.remove(lockedWorkspaceMember).flush();
        return lockedWorkspaceMember;
      },
      { clear: true },
    );
  }

  private get roles(): AuthModuleRoles {
    return resolveAuthCatalog(this.authOptions, "workspace").roles;
  }

  private get defaultRole(): string {
    return this.authOptions.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE;
  }

  private get permissions(): readonly string[] {
    return resolveAuthCatalog(this.authOptions, "workspace").permissions;
  }

  private unwrapWorkspace(member: WorkspaceMember): Workspace {
    return Reference.unwrapReference(member.workspace);
  }

  private syncCurrentMember(member: WorkspaceMember): void {
    if (this.authContext.member?.id !== member.id) {
      return;
    }
    if (member.status !== "ACTIVE") {
      this.authContext.clearWorkspace();
    } else {
      this.authContext.set({ member });
    }
  }

  private assertAuthorizationCanCommit(member: WorkspaceMember): void {
    if (this.isCurrentWorkspaceMember(member) && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Change your own membership outside an active transaction",
      );
    }
  }
}
