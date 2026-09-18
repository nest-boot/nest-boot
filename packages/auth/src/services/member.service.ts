import {
  EntityManager,
  type FilterQuery,
  LockMode,
  Reference,
  type RequiredEntityData,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
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

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { MemberConnection } from "../connections/member.connection-definition.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { AddMemberOptions } from "../interfaces/add-member-options.interface.js";
import type { UpdateMemberOptions } from "../interfaces/update-member-options.interface.js";
import type { WorkspaceHasPermissionsOptions } from "../interfaces/workspace-has-permissions-options.interface.js";
import type { WorkspacePermissionOption } from "../objects/workspace-permission-option.object.js";
import type { WorkspaceRoleOption } from "../objects/workspace-role-option.object.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import {
  listAuthPermissions,
  normalizeAuthPermissions,
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "../utils/auth-role.util.js";
import { clearWorkspaceAuthorization } from "../utils/clear-workspace-authorization.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { refreshRequestAuthorization } from "../utils/refresh-request-authorization.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { DEFAULT_WORKSPACE_ROLE } from "../workspace.constants.js";
import { AccessControlService } from "./access-control.service.js";

/** Workspace membership queries, profile management, and authorization. */
@Injectable()
export class MemberService {
  /** Creates a workspace member domain service. */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Returns the current member, rejecting user API keys outside their membership. */
  getCurrentMember(): Member | null {
    if (!RequestContext.isActive()) return null;
    const member = RequestContext.get(Member);
    if (getCurrentApiKey() && RequestContext.get(User) && !member) {
      throw new ForbiddenException(
        "The API key owner is not a member of this workspace",
      );
    }
    return member ?? null;
  }

  /** Authorizes member pagination and scopes it to the selected workspace. */
  getMemberListFilter(workspace: Workspace): FilterQuery<Member> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("read", Member);
    return { workspace } as FilterQuery<Member>;
  }

  /** Paginates members within the selected workspace and its RLS scope. */
  async getMemberConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<Member>,
  ): Promise<ConnectionInterface<Member>> {
    const where = this.getMemberListFilter(workspace);
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Member>(MemberConnection, args, { where });
  }

  /** Finds the active membership linking a user and workspace. */
  async getMemberByUser(
    workspace: Workspace,
    user: User,
  ): Promise<Member | null> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", Workspace);
    return await this.em.findOne(Member, {
      status: "ACTIVE",
      user,
      workspace,
    } as FilterQuery<Member>);
  }

  /** Finds a member by identifier within the request's selected workspace. */
  async getMember(id: string): Promise<Member | null> {
    const workspace = RequestContext.isActive()
      ? RequestContext.get(Workspace)
      : undefined;
    if (!workspace) {
      throw new ForbiddenException("A workspace must be selected");
    }
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("read", Member);
    return await this.em.findOne(Member, {
      id,
      workspace,
    } as FilterQuery<Member>);
  }

  /** Resolves a member's user with workspace authorization and request RLS. */
  async getMemberUser(member: Member): Promise<User | null> {
    const workspace = this.unwrapWorkspace(member);
    const actor = RequestContext.isActive() ? RequestContext.get(User) : null;
    const actorId = actor?.id;
    const ownMember = actorId !== undefined && member.user?.id === actorId;
    if (!ownMember) {
      this.accessControlService.assertCurrentWorkspace(workspace);
      this.accessControlService.assertUserCan("read", User);
    }
    const current = await this.em.findOne(
      Member,
      {
        id: member.id,
        workspace,
        ...(ownMember ? { user: actorId } : {}),
      } as FilterQuery<Member>,
      { refresh: true },
    );
    if (!current?.user?.id) return null;
    const user = await this.em.findOne(
      User,
      { id: current.user.id } as FilterQuery<User>,
      { refresh: true },
    );
    if (user && !ownMember)
      this.accessControlService.assertUserCan("read", user);
    return user;
  }

  /** Adds an existing user to a workspace. */
  async addMember(
    workspace: Workspace,
    user: User,
    input: AddMemberOptions = {},
  ): Promise<Member> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("create", Member);
    const permissions = this.normalizePermissions(input.permissions ?? []);
    this.accessControlService.assertCanGrantWorkspacePermissions(permissions);
    const roles = this.normalizeGrantedRoles(input.roles ?? [this.defaultRole]);
    return await this.em.transactional(
      async (em) => {
        await this.lockWorkspace(em, workspace);
        const existing = await em.findOne(
          Member,
          { user, workspace } as FilterQuery<Member>,
          { filters: false },
        );
        if (existing) throw new ConflictException("User is already a member");
        const member = em.create(Member, {
          name: user.name,
          email: user.email.trim().toLowerCase(),
          permissions,
          roles,
          status: "ACTIVE",
          user,
          workspace,
        } as unknown as RequiredEntityData<Member>);
        await em.persist(member).flush();
        await em.nativeUpdate(
          Invitation,
          {
            email: user.email.trim().toLowerCase(),
            status: "pending",
            workspace,
          } as FilterQuery<Invitation>,
          { status: "canceled" } as never,
        );
        return member;
      },
      { clear: true },
    );
  }

  /** Adds an existing user to a workspace by normalized email address. */
  async addMemberByEmail(
    workspace: Workspace,
    email: string,
    input: AddMemberOptions = {},
  ): Promise<Member> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("create", Member);
    const user = await this.getUserForMembership(workspace, email);

    return await this.addMember(workspace, user, input);
  }

  /**
   * Looks up a user for explicitly authorized membership creation.
   * Infrastructure isolates this lookup; membership writes retain request RLS.
   * @internal
   */
  async getUserForMembership(
    workspace: Workspace,
    email: string,
  ): Promise<User> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("create", Member);
    const user = await this.em.findOne(
      User,
      { email: email.trim().toLowerCase() } as FilterQuery<User>,
      { filters: false },
    );
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async resolveMemberForAction(
    member: Member | string,
    action: string,
  ): Promise<Member> {
    if (typeof member !== "string") return member;
    this.accessControlService.assertWorkspaceCan(action, Member);
    const entity = await this.em.findOne(
      Member,
      { id: member } as FilterQuery<Member>,
      { populate: ["workspace"] as never, refresh: true },
    );
    if (!entity) throw new NotFoundException("Workspace member not found");
    return entity;
  }

  /** Updates workspace-visible member profile fields and active state. */
  async updateMember(
    member: Member | string,
    input: UpdateMemberOptions,
  ): Promise<Member> {
    member = await this.resolveMemberForAction(member, "update");
    const workspace = this.unwrapWorkspace(member);
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("update", member);
    if ("roles" in input || "permissions" in input) {
      throw new BadRequestException(
        "Use setMemberRoles or setMemberPermissions to update authorization fields",
      );
    }
    if (
      input.name !== undefined &&
      (typeof input.name !== "string" || !input.name.trim())
    ) {
      throw new BadRequestException("Member name must not be empty");
    }
    this.assertAuthorizationCanCommit(member);
    const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
    const email =
      input.email === undefined
        ? undefined
        : normalizedEmail === ""
          ? null
          : normalizedEmail;
    const updated = await this.em.transactional(
      async (em) => {
        const lockedMember = await em.findOne(
          Member,
          { id: member.id, workspace } as FilterQuery<Member>,
          {
            lockMode: LockMode.PESSIMISTIC_WRITE,
            refresh: true,
          },
        );
        if (!lockedMember) {
          throw new NotFoundException("Workspace member not found");
        }
        this.accessControlService.assertWorkspaceCan("update", lockedMember);
        em.assign(lockedMember, {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        } as never);
        await em.flush();
        return lockedMember;
      },
      { clear: true },
    );
    this.refreshCurrentMember(updated);
    return updated;
  }

  /** Replaces a workspace member's roles within the caller's permission scope. */
  async setMemberRoles(
    member: Member | string,
    roleNames: string | readonly string[],
  ): Promise<Member> {
    member = await this.resolveMemberForAction(member, "update");
    const workspace = this.unwrapWorkspace(member);
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("update", member);
    const roles = this.normalizeGrantedRoles(roleNames);
    this.assertAuthorizationCanCommit(member);

    const updated = await this.em.transactional(
      async (em) => {
        const lockedMember = await em.findOne(
          Member,
          { id: member.id, workspace } as FilterQuery<Member>,
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!lockedMember) {
          throw new NotFoundException("Workspace member not found");
        }
        this.accessControlService.assertWorkspaceCan("update", lockedMember);

        lockedMember.roles = roles;
        await em.flush();
        return lockedMember;
      },
      { clear: true },
    );
    this.refreshCurrentMember(updated);
    return updated;
  }

  /** Replaces direct permissions assigned to a workspace member. */
  async setMemberPermissions(
    member: Member | string,
    permissions: readonly string[],
  ): Promise<Member> {
    member = await this.resolveMemberForAction(member, "update");
    const workspace = this.unwrapWorkspace(member);
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("update", member);
    const normalizedPermissions = this.normalizePermissions(permissions);
    this.accessControlService.assertCanGrantWorkspacePermissions(
      normalizedPermissions,
    );
    this.assertAuthorizationCanCommit(member);
    const updated = await this.em.transactional(
      async (em) => {
        const lockedMember = await em.findOne(
          Member,
          { id: member.id, workspace } as FilterQuery<Member>,
          {
            lockMode: LockMode.PESSIMISTIC_WRITE,
            refresh: true,
          },
        );
        if (!lockedMember) {
          throw new NotFoundException("Workspace member not found");
        }
        this.accessControlService.assertWorkspaceCan("update", lockedMember);
        lockedMember.permissions = normalizedPermissions;
        await em.flush();
        return lockedMember;
      },
      { clear: true },
    );
    this.refreshCurrentMember(updated);
    return updated;
  }

  private assertAuthorizationCanCommit(member: Member): void {
    if (this.isCurrentMember(member) && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Change your own membership outside an active transaction",
      );
    }
  }

  private refreshCurrentMember(member: Member): void {
    if (!this.isCurrentMember(member)) return;
    if (member.status !== "ACTIVE") {
      clearWorkspaceAuthorization(this.em);
      return;
    }
    RequestContext.set(Member, member);
    refreshRequestAuthorization(this.authOptions);
  }

  private isCurrentMember(member: Member): boolean {
    const current = RequestContext.isActive()
      ? RequestContext.get(Member)
      : null;
    return !!current && current.id === member.id;
  }

  /** Removes a member after checking delete ability; self-removal uses leaveWorkspace. */
  async removeMember(member: Member | string): Promise<Member> {
    member = await this.resolveMemberForAction(member, "delete");
    const workspace = this.unwrapWorkspace(member);
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("delete", member);
    if (this.getCurrentMember()?.id === member.id) {
      throw new ForbiddenException("You are not allowed to remove yourself");
    }
    return await this.removeMemberRecord(workspace, member, (lockedMember) => {
      this.accessControlService.assertWorkspaceCan("delete", lockedMember);
    });
  }

  /** Lets the current member leave its workspace regardless of role. */
  async leaveWorkspace(member: Member): Promise<Member> {
    this.accessControlService.assertCurrentMember(member);
    const workspace = this.unwrapWorkspace(member);
    this.accessControlService.assertCurrentWorkspace(workspace);
    // Session context can only be restaged after the removal's top-level commit.
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Leave the workspace outside an active transaction",
      );
    }
    const removed = await this.removeMemberRecord(
      workspace,
      member,
      (lockedMember) => {
        this.accessControlService.assertCurrentMember(lockedMember);
      },
    );
    clearWorkspaceAuthorization(this.em);
    return removed;
  }

  /** Checks flattened `subject:action` values against member permissions. */
  hasPermissions(
    member: Member,
    input: WorkspaceHasPermissionsOptions,
  ): boolean {
    const permissions = new Set(this.getEffectiveMemberPermissions(member));
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) => permissions.has(`${subject}:${action}`)),
    );
  }

  /** Lists all roles with grant availability; mutations still authorize their targets. */
  listRoles(): WorkspaceRoleOption[] {
    const canAssign =
      this.accessControlService.workspaceCan("create", Invitation) ||
      this.accessControlService.workspaceCan("update", Member);
    if (!canAssign)
      this.accessControlService.assertWorkspaceCan("read", Member);
    return Object.entries(this.roles).map(([role, permissions]) => ({
      role,
      grantable:
        canAssign &&
        this.accessControlService.canGrantWorkspacePermissions(permissions),
    }));
  }

  /** Lists all direct-permission options without authorizing a particular member. */
  listPermissions(): WorkspacePermissionOption[] {
    const canAssign = this.accessControlService.workspaceCan("update", Member);
    if (!canAssign)
      this.accessControlService.assertWorkspaceCan("read", Member);
    return listAuthPermissions(this.permissions).map((permission) => ({
      permission,
      grantable:
        canAssign &&
        this.accessControlService.canGrantWorkspacePermissions([permission]),
    }));
  }

  /** Resolves permissions inherited from roles plus direct member permissions. */
  getEffectiveMemberPermissions(member: Member): string[] {
    return resolveAuthPermissions(
      member.roles ?? [this.defaultRole],
      member.permissions ?? [],
      this.roles,
    );
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
    this.accessControlService.assertCanGrantWorkspacePermissions(
      resolveAuthPermissions(roles, [], this.roles),
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

  private async removeMemberRecord(
    workspace: Workspace,
    member: Member,
    assertAccess: (member: Member) => void,
  ): Promise<Member> {
    return await this.em.transactional(
      async (em) => {
        const lockedMember = await em.findOne(
          Member,
          { id: member.id, workspace } as FilterQuery<Member>,
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!lockedMember) {
          throw new NotFoundException("Workspace member not found");
        }
        assertAccess(lockedMember);

        await em.remove(lockedMember).flush();
        return lockedMember;
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

  private unwrapWorkspace(member: Member): Workspace {
    return Reference.unwrapReference(member.workspace) as unknown as Workspace;
  }
}
