import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  Reference,
  type RequiredEntityData,
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
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type {
  AuthModuleOptions,
  AuthWorkspaceInvitationEmailInviter,
} from "./auth-module-options.interface.js";
import type {
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
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
  ) {}

  /** Finds a workspace matching the supplied filter. */
  async findOne(where: FilterQuery<Workspace>): Promise<Workspace | null> {
    return await this.em.findOne(this.workspaceEntity, where);
  }

  /** Lists active workspaces to which a user belongs. */
  async listWorkspaces(user: User): Promise<Workspace[]> {
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
    const workspace = this.em.create(this.workspaceEntity, {
      name: input.name,
    } as unknown as RequiredEntityData<Workspace>);
    const workspaceMember = this.em.create(this.workspaceMemberEntity, {
      email: user.email,
      name: user.name,
      role: "OWNER",
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
    this.em.assign(workspace, input as never);
    await this.em.flush();
    return workspace;
  }

  /** Soft-deletes a workspace after enforcing the owner invariant. */
  async deleteWorkspace(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
  ): Promise<Workspace> {
    if (
      currentWorkspaceMember.role !== "OWNER" ||
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
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceMemberEntity,
          { status: "ACTIVE", user, workspace } as FilterQuery<WorkspaceMember>,
          { filters: false },
        ),
    );
  }

  /** Lists active and disabled members of a workspace. */
  async listMembers(workspace: Workspace): Promise<WorkspaceMember[]> {
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
      permissions: input.permissions ?? [],
      role: input.role ?? "MEMBER",
      status: "ACTIVE",
      user,
      workspace,
    } as unknown as RequiredEntityData<WorkspaceMember>);
    await this.em.persist(member).flush();
    return member;
  }

  /** Updates a member's profile, role, permissions, or active state. */
  async updateMember(
    member: WorkspaceMember,
    input: UpdateWorkspaceMemberOptions,
  ): Promise<WorkspaceMember> {
    this.em.assign(member, input as never);
    await this.em.flush();
    return member;
  }

  /** Removes a non-owner member from its workspace. */
  async removeMember(member: WorkspaceMember): Promise<WorkspaceMember> {
    if (member.role === "OWNER") {
      throw new ForbiddenException("Workspace owners cannot be removed");
    }
    await this.em.remove(member).flush();
    return member;
  }

  /** Lets a non-owner member leave its workspace. */
  async leaveWorkspace(member: WorkspaceMember): Promise<WorkspaceMember> {
    return await this.removeMember(member);
  }

  /** Creates a pending workspace invitation. */
  async createInvitation(
    workspace: Workspace,
    inviter: User,
    input: CreateWorkspaceInvitationOptions,
    request?: Request,
  ): Promise<WorkspaceInvitation> {
    const email = input.email.toLowerCase();
    const [member, invitation] = await this.withRlsDisabled(
      async () =>
        await Promise.all([
          this.em.findOne(
            this.workspaceMemberEntity,
            { email, workspace } as FilterQuery<WorkspaceMember>,
            { filters: false },
          ),
          this.em.findOne(
            this.workspaceInvitationEntity,
            {
              email,
              status: "pending",
              workspace,
            } as FilterQuery<WorkspaceInvitation>,
            { filters: false },
          ),
        ]),
    );
    if (member) {
      throw new ConflictException("User is already a member");
    }
    if (invitation) {
      throw new ConflictException("User is already invited to this workspace");
    }

    const sendInvitationEmail = this.authOptions.workspace?.sendInvitationEmail;
    const inviterMember = sendInvitationEmail
      ? await this.getMember(workspace, inviter)
      : null;
    if (sendInvitationEmail && !inviterMember) {
      throw new ForbiddenException(
        "Invitation sender is not an active workspace member",
      );
    }

    const created = this.em.create(this.workspaceInvitationEntity, {
      email,
      expiresAt: new Date(
        Date.now() + (input.expiresIn ?? 60 * 60 * 48) * 1000,
      ),
      inviter,
      role: input.role ?? "MEMBER",
      status: "pending",
      workspace,
    } as unknown as RequiredEntityData<WorkspaceInvitation>);
    await this.em.persist(created).flush();

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
          role: created.role,
          workspace,
        },
        request,
      );
    }

    return created;
  }

  /** Finds an invitation by its ID. */
  async getInvitation(id: string): Promise<WorkspaceInvitation | null> {
    return await this.withRlsDisabled(
      async () =>
        await this.em.findOne(
          this.workspaceInvitationEntity,
          { id } as FilterQuery<WorkspaceInvitation>,
          { filters: false },
        ),
    );
  }

  /** Lists invitations for a workspace. */
  async listInvitations(workspace: Workspace): Promise<WorkspaceInvitation[]> {
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
    return await this.withRlsDisabled(
      async () =>
        await this.em.find(
          this.workspaceInvitationEntity,
          {
            email: user.email.toLowerCase(),
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
    const invitation = await this.getInvitation(invitationId);
    if (!invitation) return null;
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
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
      permissions: [],
      role: invitation.role,
      status: "ACTIVE",
      user,
      workspace,
    } as unknown as RequiredEntityData<WorkspaceMember>);
    invitation.status = "accepted";
    await this.withRlsDisabled(() => this.em.persist(member).flush());
    return { invitation, member };
  }

  /** Cancels a pending invitation. */
  async cancelInvitation(
    invitation: WorkspaceInvitation,
  ): Promise<WorkspaceInvitation> {
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
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) =>
        member.permissions.includes(`${subject}:${action}`),
      ),
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

  private get workspaceMemberEntity(): EntityClass<WorkspaceMember> {
    return this.authOptions.entities
      .workspaceMember as EntityClass<WorkspaceMember>;
  }

  private get workspaceInvitationEntity(): EntityClass<WorkspaceInvitation> {
    return this.authOptions.entities
      .workspaceInvitation as EntityClass<WorkspaceInvitation>;
  }
}
