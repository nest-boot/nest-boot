import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  LockMode,
  Reference,
  type RequiredEntityData,
  UniqueConstraintViolationException,
} from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type {
  AuthModuleOptions,
  AuthWorkspaceInvitationEmailInviter,
} from "./auth-module-options.interface.js";
import { AuthorizationService } from "./authorization.service.js";
import type {
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import type { AuthRole } from "./interfaces/auth-role.interface.js";
import type {
  AcceptWorkspaceInvitationResult,
  AddWorkspaceMemberOptions,
  CreateWorkspaceInvitationOptions,
  CreateWorkspaceOptions,
  FullWorkspace,
  UpdateWorkspaceMemberOptions,
  UpdateWorkspaceOptions,
  WorkspaceHasPermissionOptions,
} from "./interfaces/workspace-service.interface.js";
import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";
import {
  listAuthPermissions,
  listAuthRoles,
  normalizeAuthPermissions,
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "./utils/auth-role.util.js";
import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

/** Workspace, membership, and invitation domain operations. */
@Injectable()
export class WorkspaceService<
  Workspace extends BaseWorkspace = BaseWorkspace,
  WorkspaceMember extends BaseWorkspaceMember = BaseWorkspaceMember,
  WorkspaceInvitation extends BaseWorkspaceInvitation = BaseWorkspaceInvitation,
  User extends BaseUser = BaseUser,
> {
  /** Creates a workspace domain service. */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /** Finds a workspace matching the supplied filter. */
  async findOne(where: FilterQuery<Workspace>): Promise<Workspace | null> {
    this.authorizationService.assertUserCan("read", this.workspaceEntity);
    return await this.em.findOne(this.workspaceEntity, where);
  }

  /** Lists active workspaces to which a user belongs. */
  async listWorkspaces(user: User): Promise<Workspace[]> {
    this.authorizationService.assertCurrentUser(user);
    this.authorizationService.assertUserCan("read", this.workspaceEntity);
    return await this.withRlsDisabled(async () => {
      const memberships = await this.em.find(
        this.workspaceMemberEntity,
        { status: "ACTIVE", user } as FilterQuery<WorkspaceMember>,
        { filters: false, populate: ["workspace"] as never },
      );

      return memberships
        .map((membership) => this.unwrapWorkspace(membership))
        .filter((workspace) => !workspace.deletedAt);
    });
  }

  /** Creates a workspace and its owner membership atomically. */
  async createWorkspace(
    user: User,
    input: CreateWorkspaceOptions,
  ): Promise<Workspace> {
    this.authorizationService.assertCurrentUser(user);
    this.authorizationService.assertUserCan("create", this.workspaceEntity);
    const workspace = this.em.create(this.workspaceEntity, {
      name: input.name,
    } as unknown as RequiredEntityData<Workspace>);
    const workspaceMember = this.em.create(this.workspaceMemberEntity, {
      email: user.email,
      name: user.name,
      roles: [this.creatorRole],
      status: "ACTIVE",
      user,
      workspace,
    } as unknown as RequiredEntityData<WorkspaceMember>);

    await this.em.persist(workspace).persist(workspaceMember).flush();
    return workspace;
  }

  /** Returns a workspace together with its members and invitation records. */
  async getFullWorkspace(
    workspace: Workspace,
  ): Promise<FullWorkspace<Workspace, WorkspaceMember, WorkspaceInvitation>> {
    this.authorizationService.assertWorkspaceCan("read", workspace);
    const [members, invitations] = await this.withRlsDisabled(
      async () =>
        await Promise.all([
          this.em.find(
            this.workspaceMemberEntity,
            { workspace } as FilterQuery<WorkspaceMember>,
            { filters: false },
          ),
          this.em.find(
            this.workspaceInvitationEntity,
            { workspace } as FilterQuery<WorkspaceInvitation>,
            {
              filters: false,
              orderBy: { createdAt: "desc" } as never,
            },
          ),
        ]),
    );

    return {
      workspace,
      members,
      invitations,
    };
  }

  /** Updates mutable workspace fields. */
  async updateWorkspace(
    workspace: Workspace,
    input: UpdateWorkspaceOptions,
  ): Promise<Workspace> {
    this.authorizationService.assertWorkspaceCan("update", workspace);
    this.em.assign(workspace, input as never);
    await this.em.flush();
    return workspace;
  }

  /** Soft-deletes a workspace after enforcing the owner invariant. */
  async deleteWorkspace(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
  ): Promise<Workspace> {
    this.authorizationService.assertCurrentWorkspaceMember(
      currentWorkspaceMember,
    );
    this.authorizationService.assertWorkspaceCan("delete", workspace);
    if (
      !currentWorkspaceMember.roles.includes(this.creatorRole) ||
      this.unwrapWorkspace(currentWorkspaceMember).id !== workspace.id
    ) {
      throw new ForbiddenException("Only workspace owners can delete it");
    }

    return await this.withRlsDisabled(async () => {
      this.em.assign(workspace, { deletedAt: new Date() } as never);
      await this.em.flush();
      return workspace;
    });
  }

  /** Finds the active membership linking a user and workspace. */
  async getMember(
    workspace: Workspace,
    user: User,
  ): Promise<WorkspaceMember | null> {
    this.authorizationService.assertCurrentUser(user);
    this.authorizationService.assertUserCan("read", this.workspaceEntity);
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceMemberEntity,
          { status: "ACTIVE", user, workspace } as FilterQuery<WorkspaceMember>,
          { filters: false },
        ),
    );
  }

  /** Finds a workspace member by identifier inside the supplied workspace. */
  async getMemberById(
    workspace: Workspace,
    memberId: string,
  ): Promise<WorkspaceMember | null> {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceMemberEntity,
    );
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceMemberEntity,
          { id: memberId, workspace } as FilterQuery<WorkspaceMember>,
          { filters: false },
        ),
    );
  }

  /** Lists active and disabled members of a workspace. */
  async listMembers(workspace: Workspace): Promise<WorkspaceMember[]> {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceMemberEntity,
    );
    return await this.withRlsDisabled(
      async () =>
        await this.em.find(
          this.workspaceMemberEntity,
          {
            status: { $in: ["ACTIVE", "DISABLED"] },
            workspace,
          } as FilterQuery<WorkspaceMember>,
          { filters: false, orderBy: { createdAt: "asc" } as never },
        ),
    );
  }

  /** Adds an existing user to a workspace. */
  async addMember(
    workspace: Workspace,
    user: User,
    input: AddWorkspaceMemberOptions = {},
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan(
      "create",
      this.workspaceMemberEntity,
    );
    const permissions = this.normalizePermissions(input.permissions ?? []);
    const existing = await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceMemberEntity,
          { user, workspace } as FilterQuery<WorkspaceMember>,
          { filters: false },
        ),
    );
    if (existing) throw new ConflictException("User is already a member");

    const member = this.em.create(this.workspaceMemberEntity, {
      email: user.email,
      name: user.name,
      permissions,
      roles: this.normalizeAssignableRoles(input.roles ?? [this.defaultRole]),
      status: "ACTIVE",
      user,
      workspace,
    } as unknown as RequiredEntityData<WorkspaceMember>);
    await this.em.persist(member).flush();
    return member;
  }

  /** Adds an existing user to a workspace by normalized email address. */
  async addMemberByEmail(
    workspace: Workspace,
    email: string,
    input: AddWorkspaceMemberOptions = {},
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan(
      "create",
      this.workspaceMemberEntity,
    );
    const user = await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.userEntity,
          { email: email.trim().toLowerCase() } as FilterQuery<User>,
          { filters: false },
        ),
    );
    if (!user) throw new NotFoundException("User not found");

    return await this.addMember(workspace, user, input);
  }

  /** Updates a member's profile or active state. */
  async updateMember(
    member: WorkspaceMember,
    input: UpdateWorkspaceMemberOptions,
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan("update", member);
    if ("roles" in input || "permissions" in input) {
      throw new BadRequestException(
        "Use updateMemberRole or setMemberPermissions to update authorization fields",
      );
    }
    this.em.assign(member, input as never);
    await this.em.flush();
    return member;
  }

  /** Replaces the roles assigned to a non-owner workspace member. */
  async updateMemberRole(
    member: WorkspaceMember,
    role: string | readonly string[],
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan("update", member);
    if (member.roles.includes(this.creatorRole)) {
      throw new ForbiddenException(
        "Workspace owner roles can only be changed by transferring ownership",
      );
    }

    const roles = this.normalizeRoles(role);
    if (roles.includes(this.creatorRole)) {
      throw new ForbiddenException(
        "The owner role can only be assigned by transferring ownership",
      );
    }

    member.roles = roles;
    await this.em.flush();
    return member;
  }

  /** Replaces direct permissions assigned to a workspace member. */
  async setMemberPermissions(
    member: WorkspaceMember,
    permissions: readonly string[],
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan("update", member);
    member.permissions = this.normalizePermissions(permissions);
    await this.em.flush();
    return member;
  }

  /** Removes a non-owner member from its workspace. */
  async removeMember(member: WorkspaceMember): Promise<WorkspaceMember> {
    this.authorizationService.assertWorkspaceCan("delete", member);
    if (member.roles.includes(this.creatorRole)) {
      throw new ForbiddenException("Workspace owners cannot be removed");
    }
    await this.em.remove(member).flush();
    return member;
  }

  /** Lets a non-owner member leave its workspace. */
  async leaveWorkspace(member: WorkspaceMember): Promise<WorkspaceMember> {
    this.authorizationService.assertCurrentWorkspaceMember(member);
    if (member.roles.includes(this.creatorRole)) {
      throw new ForbiddenException("Workspace owners cannot leave");
    }
    await this.em.remove(member).flush();
    return member;
  }

  /** Transfers ownership and keeps the previous owner as an administrator. */
  async transferOwnership(
    workspace: Workspace,
    currentOwner: WorkspaceMember,
    nextOwner: WorkspaceMember,
  ): Promise<WorkspaceMember> {
    this.authorizationService.assertCurrentWorkspaceMember(currentOwner);
    this.authorizationService.assertWorkspaceCan("update", workspace);
    if (
      !currentOwner.roles.includes(this.creatorRole) ||
      this.unwrapWorkspace(currentOwner).id !== workspace.id
    ) {
      throw new ForbiddenException(
        "Only the current workspace owner can transfer ownership",
      );
    }
    if (
      currentOwner.id === nextOwner.id ||
      this.unwrapWorkspace(nextOwner).id !== workspace.id ||
      nextOwner.status !== "ACTIVE"
    ) {
      throw new BadRequestException(
        "The next owner must be another active workspace member",
      );
    }

    return await this.withRlsDisabled(
      async () =>
        await this.em.transactional(async (em) => {
          await em.lock(currentOwner, LockMode.PESSIMISTIC_WRITE);
          await em.lock(nextOwner, LockMode.PESSIMISTIC_WRITE);

          if (!currentOwner.roles.includes(this.creatorRole)) {
            throw new ForbiddenException(
              "Workspace ownership has already changed",
            );
          }

          currentOwner.roles = [this.defaultRole];
          nextOwner.roles = [this.creatorRole];
          await em.flush();
          return nextOwner;
        }),
    );
  }

  /** Creates a pending workspace invitation. */
  async createInvitation(
    workspace: Workspace,
    inviter: User,
    input: CreateWorkspaceInvitationOptions,
    request?: Request,
  ): Promise<WorkspaceInvitation> {
    this.authorizationService.assertCurrentUser(inviter);
    this.authorizationService.assertWorkspaceCan(
      "create",
      this.workspaceInvitationEntity,
    );
    const email = input.email.toLowerCase();
    const now = new Date();
    const sendInvitationEmail = this.authOptions.workspace?.sendInvitationEmail;
    let transactionResult: {
      created: WorkspaceInvitation;
      inviterMember: WorkspaceMember | null;
    };

    try {
      transactionResult = await this.withRlsDisabled(
        async () =>
          await this.em.transactional(async (em) => {
            const [member, invitation, inviterMember] = await Promise.all([
              em.findOne(
                this.workspaceMemberEntity,
                { email, workspace } as FilterQuery<WorkspaceMember>,
                { filters: false },
              ),
              em.findOne(
                this.workspaceInvitationEntity,
                {
                  email,
                  status: "pending",
                  workspace,
                } as FilterQuery<WorkspaceInvitation>,
                { filters: false },
              ),
              sendInvitationEmail
                ? em.findOne(
                    this.workspaceMemberEntity,
                    {
                      status: "ACTIVE",
                      user: inviter,
                      workspace,
                    } as FilterQuery<WorkspaceMember>,
                    { filters: false },
                  )
                : Promise.resolve(null),
            ]);

            if (member) {
              throw new ConflictException("User is already a member");
            }
            if (invitation && invitation.expiresAt.getTime() > now.getTime()) {
              throw new ConflictException(
                "User is already invited to this workspace",
              );
            }
            if (sendInvitationEmail && !inviterMember) {
              throw new ForbiddenException(
                "Invitation sender is not an active workspace member",
              );
            }
            if (invitation) invitation.status = "canceled";

            const created = em.create(this.workspaceInvitationEntity, {
              email,
              expiresAt: new Date(
                now.getTime() + (input.expiresIn ?? 60 * 60 * 48) * 1000,
              ),
              inviter,
              roles: this.normalizeAssignableRoles(
                input.roles ?? [this.defaultRole],
              ),
              status: "pending",
              workspace,
            } as unknown as RequiredEntityData<WorkspaceInvitation>);
            await em.persist(created).flush();
            return { created, inviterMember };
          }),
      );
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException(
          "User is already invited to this workspace",
        );
      }
      throw error;
    }

    const { created, inviterMember } = transactionResult;

    if (sendInvitationEmail && inviterMember) {
      const callbackInviter = Object.assign(
        Object.create(Object.getPrototypeOf(inviterMember)) as WorkspaceMember,
        inviterMember,
        { user: inviter },
      ) as unknown as AuthWorkspaceInvitationEmailInviter;

      await sendInvitationEmail(
        {
          email,
          id: created.id,
          invitation: created,
          inviter: callbackInviter,
          roles: [...created.roles],
          workspace,
        },
        request,
      );
    }

    return created;
  }

  /** Finds an invitation when it is addressed to the supplied user. */
  async getUserInvitation(
    id: string,
    user: User,
  ): Promise<WorkspaceInvitation | null> {
    this.authorizationService.assertCurrentUser(user);
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceInvitationEntity,
          {
            id,
            email: user.email.toLowerCase(),
          } as FilterQuery<WorkspaceInvitation>,
          { filters: false },
        ),
    );
  }

  /** Finds an invitation owned by the supplied workspace. */
  async getWorkspaceInvitation(
    id: string,
    workspace: Workspace,
  ): Promise<WorkspaceInvitation | null> {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceInvitationEntity,
    );
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceInvitationEntity,
          { id, workspace } as FilterQuery<WorkspaceInvitation>,
          { filters: false },
        ),
    );
  }

  /** Lists invitations for a workspace. */
  async listInvitations(workspace: Workspace): Promise<WorkspaceInvitation[]> {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceInvitationEntity,
    );
    return await this.withRlsDisabled(
      async () =>
        await this.em.find(
          this.workspaceInvitationEntity,
          { workspace } as FilterQuery<WorkspaceInvitation>,
          { filters: false, orderBy: { createdAt: "desc" } as never },
        ),
    );
  }

  /** Lists pending invitations addressed to a user. */
  async listUserInvitations(user: User): Promise<WorkspaceInvitation[]> {
    this.authorizationService.assertCurrentUser(user);
    const now = new Date();
    return await this.withRlsDisabled(
      async () =>
        await this.em.find(
          this.workspaceInvitationEntity,
          {
            email: user.email.toLowerCase(),
            expiresAt: { $gt: now },
            status: "pending",
          } as FilterQuery<WorkspaceInvitation>,
          { filters: false, orderBy: { createdAt: "desc" } as never },
        ),
    );
  }

  /** Accepts a pending invitation and creates an active membership. */
  async acceptInvitation(
    user: User,
    invitationId: string,
  ): Promise<AcceptWorkspaceInvitationResult<
    WorkspaceInvitation,
    WorkspaceMember
  > | null> {
    this.authorizationService.assertCurrentUser(user);
    return await this.withRlsDisabled(
      async () =>
        await this.em.transactional(async (em) => {
          const invitation = await em.findOne(
            this.workspaceInvitationEntity,
            { id: invitationId } as FilterQuery<WorkspaceInvitation>,
            { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!invitation) return null;
          if (invitation.status !== "pending") {
            throw new BadRequestException(
              "Workspace invitation is not pending",
            );
          }
          if (invitation.expiresAt.getTime() <= Date.now()) {
            throw new BadRequestException("Workspace invitation has expired");
          }
          if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
            throw new ForbiddenException(
              "Workspace invitation belongs to another email address",
            );
          }

          const workspace = this.unwrapInvitationWorkspace(invitation);
          const existing = await em.findOne(
            this.workspaceMemberEntity,
            { user, workspace } as FilterQuery<WorkspaceMember>,
            { filters: false },
          );
          if (existing) throw new ConflictException("User is already a member");

          const member = em.create(this.workspaceMemberEntity, {
            email: user.email,
            name: user.name,
            permissions: [],
            roles: this.normalizeAssignableRoles(invitation.roles),
            status: "ACTIVE",
            user,
            workspace,
          } as unknown as RequiredEntityData<WorkspaceMember>);
          invitation.status = "accepted";
          await em.persist(member).flush();
          return { invitation, member };
        }),
    );
  }

  /** Cancels a pending invitation. */
  async cancelInvitation(
    invitation: WorkspaceInvitation,
  ): Promise<WorkspaceInvitation> {
    this.authorizationService.assertWorkspaceCan("cancel", invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    invitation.status = "canceled";
    await this.withRlsDisabled(() => this.em.flush());
    return invitation;
  }

  /** Rejects an invitation after verifying the invited user's email. */
  async rejectInvitation(
    user: User,
    invitation: WorkspaceInvitation,
  ): Promise<WorkspaceInvitation> {
    this.authorizationService.assertCurrentUser(user);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        "Workspace invitation belongs to another email address",
      );
    }
    invitation.status = "rejected";
    await this.withRlsDisabled(() => this.em.flush());
    return invitation;
  }

  /** Checks flattened `subject:action` values against member permissions. */
  hasPermission(
    member: WorkspaceMember,
    input: WorkspaceHasPermissionOptions,
  ): boolean {
    const permissions = new Set(this.getMemberPermissions(member));
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) => permissions.has(`${subject}:${action}`)),
    );
  }

  /** Lists configured workspace roles. */
  listRoles(): AuthRole[] {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceMemberEntity,
    );
    return listAuthRoles(this.roles);
  }

  /** Lists configured workspace permissions. */
  listPermissions(): string[] {
    this.authorizationService.assertWorkspaceCan(
      "read",
      this.workspaceMemberEntity,
    );
    return listAuthPermissions(this.permissions);
  }

  /** Resolves permissions inherited from roles plus direct member permissions. */
  getMemberPermissions(member: WorkspaceMember): string[] {
    return resolveAuthPermissions(
      member.roles ?? [this.defaultRole],
      member.permissions ?? [],
      this.roles,
    );
  }

  private normalizeRoles(role: string | readonly string[]): string[] {
    return normalizeAuthRoles(role, this.roles);
  }

  private normalizeAssignableRoles(role: string | readonly string[]): string[] {
    const roles = this.normalizeRoles(role);
    if (roles.includes(this.creatorRole)) {
      throw new ForbiddenException(
        "The owner role can only be assigned by transferring ownership",
      );
    }
    return roles;
  }

  private normalizePermissions(permissions: readonly string[]): string[] {
    return normalizeAuthPermissions(
      permissions,
      this.permissions,
      "Workspace member",
    );
  }

  private get roles(): AuthModuleRoles {
    return this.authOptions.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES;
  }

  private get defaultRole(): string {
    return this.authOptions.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE;
  }

  private get creatorRole(): string {
    return (
      this.authOptions.workspace?.creatorRole ?? DEFAULT_WORKSPACE_CREATOR_ROLE
    );
  }

  private get permissions(): readonly string[] {
    return (
      this.authOptions.workspace?.permissions ?? DEFAULT_WORKSPACE_PERMISSIONS
    );
  }

  private unwrapWorkspace(member: WorkspaceMember): Workspace {
    return Reference.unwrapReference(member.workspace) as unknown as Workspace;
  }

  private unwrapInvitationWorkspace(
    invitation: WorkspaceInvitation,
  ): Workspace {
    return Reference.unwrapReference(
      invitation.workspace,
    ) as unknown as Workspace;
  }

  private async withRlsDisabled<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) return await RequestContext.child(run);
    return await RequestContext.run(
      new RequestContext({ type: "auth-workspace" }),
      run,
    );
  }

  private get workspaceEntity(): EntityClass<Workspace> {
    return this.authOptions.entities.workspace as EntityClass<Workspace>;
  }

  private get userEntity(): EntityClass<User> {
    return this.authOptions.entities.user as EntityClass<User>;
  }

  private get workspaceMemberEntity(): EntityClass<WorkspaceMember> {
    return this.authOptions.entities
      .workspaceMember as EntityClass<WorkspaceMember>;
  }

  private get workspaceInvitationEntity(): EntityClass<WorkspaceInvitation> {
    return this.authOptions.entities
      .workspaceInvitation as EntityClass<WorkspaceInvitation>;
  }
}
