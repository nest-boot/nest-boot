import {
  EntityManager,
  LockMode,
  Reference,
  UniqueConstraintViolationException,
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
import { assertCanGrantPermissions } from "../../common/utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../../common/utils/resolve-auth-catalog.util.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { RequestIdentity } from "../../core/request-identity.js";
import type { AuthModuleRoles } from "../../core/types/auth-module-roles.type.js";
import {
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "../../core/utils/auth-role.util.js";
import { WorkspaceInvitationConnection } from "../connections/workspace-invitation.connection-definition.js";
import { DEFAULT_WORKSPACE_ROLE } from "../constants/workspace.constants.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import type { AcceptWorkspaceInvitationResult } from "../interfaces/accept-workspace-invitation-result.interface.js";
import type { CreateWorkspaceInvitationOptions } from "../interfaces/create-workspace-invitation-options.interface.js";

/** Workspace invitation queries and lifecycle operations. */
@Injectable()
export class WorkspaceInvitationService {
  /**
   * Creates a workspace invitation domain service.
   * @param em - Entity manager used for persistence.
   * @param authOptions - Authentication module configuration.
   */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /**
   * Creates a pending workspace invitation.
   * @param workspace - The workspace that scopes this operation.
   * @param inviter - User who sends the invitation.
   * @param input - Requested field values for the operation.
   * @param request - Incoming HTTP request.
   * @returns Persisted invitation.
   */
  async createWorkspaceInvitation(
    workspace: Workspace,
    inviter: User,
    input: CreateWorkspaceInvitationOptions,
    request?: Request,
  ): Promise<WorkspaceInvitation> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    RequestIdentity.assertCurrentUser(inviter);
    authorize("write", WorkspaceInvitation);
    const email = input.email.trim().toLowerCase();
    const roles = this.normalizeGrantedRoles(input.roles ?? [this.defaultRole]);
    const expiresIn = input.expiresIn ?? 60 * 60 * 48;
    if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
      throw new BadRequestException(
        "Workspace invitation lifetime must be a positive integer",
      );
    }
    const sendWorkspaceInvitationEmail =
      this.authOptions.workspace?.sendWorkspaceInvitationEmail;
    if (sendWorkspaceInvitationEmail && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Create invitations with email delivery outside an active transaction",
      );
    }
    let transactionResult: {
      created: WorkspaceInvitation;
      inviterWorkspaceMember: WorkspaceMember | null;
    };

    try {
      transactionResult = await this.em.transactional(
        async (em) => {
          await this.lockWorkspace(em, workspace);
          const now = new Date();
          const userId = await this.getUserIdForWorkspaceInvitation(
            workspace,
            inviter,
            email,
          );
          const [member, invitation, inviterWorkspaceMember] =
            await Promise.all([
              userId
                ? em.findOne(
                    WorkspaceMember,
                    { workspace, user: userId },
                    { filters: false },
                  )
                : Promise.resolve(null),
              em.findOne(
                WorkspaceInvitation,
                {
                  email,
                  status: "pending",
                  workspace,
                },
                { filters: false },
              ),
              sendWorkspaceInvitationEmail
                ? em.findOne(
                    WorkspaceMember,
                    {
                      status: "ACTIVE",
                      user: inviter,
                      workspace,
                    },
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
          if (sendWorkspaceInvitationEmail && !inviterWorkspaceMember) {
            throw new ForbiddenException(
              "WorkspaceInvitation sender is not an active workspace member",
            );
          }
          if (invitation) {
            invitation.status = "canceled";
            await em.flush();
          }

          const created = em.create(WorkspaceInvitation, {
            email,
            expiresAt: new Date(now.getTime() + expiresIn * 1000),
            inviter,
            roles,
            status: "pending",
            workspace,
          });
          authorize("write", created);
          await em.persist(created).flush();
          return { created, inviterWorkspaceMember };
        },
        { clear: true },
      );
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException(
          "User is already invited to this workspace",
        );
      }
      throw error;
    }

    const { created, inviterWorkspaceMember } = transactionResult;

    if (sendWorkspaceInvitationEmail && inviterWorkspaceMember) {
      const callbackInviter = Object.assign(
        new WorkspaceMember(),
        inviterWorkspaceMember,
        {
          user: inviter,
        },
      );

      try {
        await sendWorkspaceInvitationEmail(
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
      } catch (error) {
        await this.em.nativeUpdate(
          WorkspaceInvitation,
          {
            id: created.id,
            status: "pending",
          },
          { status: "canceled" },
        );
        throw error;
      }
    }

    return created;
  }

  /**
   * Resolves only the login identity needed for invitation membership checks.
   * Infrastructure isolates this lookup; invitation writes retain request RLS.
   * An unregistered email is a valid invitation recipient.
   * @param workspace - The workspace that scopes this operation.
   * @param inviter - User who sends the invitation.
   * @param email - Email address used to identify the user.
   * @returns Identifier of the user with the invitation email, or null.
   * @internal
   */
  async getUserIdForWorkspaceInvitation(
    workspace: Workspace,
    inviter: User,
    email: string,
  ): Promise<string | null> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    RequestIdentity.assertCurrentUser(inviter);
    authorize("write", WorkspaceInvitation);
    const user = await this.em.findOne(
      User,
      { email: email.trim().toLowerCase() },
      { fields: ["id"], filters: false },
    );
    return user ? String(user.id) : null;
  }

  /**
   * Finds an invitation after recipient or workspace authorization, preserving RLS.
   * @param id - Identifier of the record to access.
   * @returns Accessible invitation, or null if it does not exist.
   */
  async getWorkspaceInvitation(
    id: string,
  ): Promise<WorkspaceInvitation | null> {
    const recipientSession =
      RequestContext.isActive() &&
      RequestContext.get(User) &&
      !getCurrentApiKey();
    if (!recipientSession && !can("read", WorkspaceInvitation)) {
      throw new ForbiddenException("WorkspaceInvitation read access denied");
    }
    const invitation = await this.em.findOne(
      WorkspaceInvitation,
      { id },
      { refresh: true },
    );
    if (invitation) {
      this.assertWorkspaceInvitationReadAccess(invitation);
    }
    return invitation;
  }

  /**
   * Resolves the inviter through an authorized invitation without bypassing RLS.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns User who sent the invitation.
   */
  async getWorkspaceInvitationInviter(
    invitation: WorkspaceInvitation,
  ): Promise<User> {
    const current = await this.getWorkspaceInvitationForRelation(invitation);
    const actor = RequestContext.isActive() ? RequestContext.get(User) : null;
    const self = !getCurrentApiKey() && actor?.id === current.inviter.id;
    if (!self) {
      authorize("read", User);
    }
    const user = await this.em.findOne(
      User,
      { id: current.inviter.id },
      { refresh: true },
    );
    if (!user) {
      throw new NotFoundException("WorkspaceInvitation inviter not found");
    }
    if (!self) {
      authorize("read", user);
    }
    return user;
  }

  /**
   * Resolves the workspace through an authorized invitation without requiring membership.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns Workspace to which the invitation grants membership.
   */
  async getWorkspaceInvitationWorkspace(
    invitation: WorkspaceInvitation,
  ): Promise<Workspace> {
    const current = await this.getWorkspaceInvitationForRelation(invitation);
    const workspace = await this.em.findOne(
      Workspace,
      { id: current.workspace.id },
      { refresh: true },
    );
    if (!workspace) {
      throw new NotFoundException("WorkspaceInvitation workspace not found");
    }
    return workspace;
  }

  private async getWorkspaceInvitationForRelation(
    invitation: WorkspaceInvitation,
  ): Promise<WorkspaceInvitation> {
    this.assertWorkspaceInvitationReadAccess(invitation);
    // Re-read through this manager: a mutation may return entities/references
    // hydrated by the isolated authentication context, or an older identity.
    const current = await this.em.findOne(
      WorkspaceInvitation,
      { id: invitation.id },
      { refresh: true },
    );
    if (!current) {
      throw new NotFoundException("Workspace invitation not found");
    }
    this.assertWorkspaceInvitationReadAccess(current);
    return current;
  }

  private assertWorkspaceInvitationReadAccess(
    invitation: WorkspaceInvitation,
  ): void {
    const user = RequestContext.isActive() ? RequestContext.get(User) : null;
    if (
      invitation.email.toLowerCase() === user?.email?.toLowerCase() &&
      !getCurrentApiKey()
    ) {
      return;
    }
    RequestIdentity.assertCurrentWorkspace(
      this.unwrapWorkspaceInvitationWorkspace(invitation),
    );
    authorize("read", invitation);
  }

  /**
   * Finds an invitation when it is addressed to the supplied user.
   * @param id - Identifier of the record to access.
   * @param user - The user whose account is being accessed.
   * @returns Accessible invitation addressed to the user, or null.
   */
  async getWorkspaceInvitationByUser(
    id: string,
    user: User,
  ): Promise<WorkspaceInvitation | null> {
    RequestIdentity.assertUserSession(user);
    const invitation = await this.em.findOne(WorkspaceInvitation, {
      id,
      email: user.email.toLowerCase(),
    });
    return invitation;
  }

  /**
   * Finds an invitation owned by the supplied workspace.
   * @param id - Identifier of the record to access.
   * @param workspace - The workspace that scopes this operation.
   * @returns Accessible invitation in the workspace, or null.
   */
  async getWorkspaceInvitationByWorkspace(
    id: string,
    workspace: Workspace,
  ): Promise<WorkspaceInvitation | null> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    authorize("read", WorkspaceInvitation);
    const invitation = await this.em.findOne(WorkspaceInvitation, {
      id,
      workspace,
    });
    if (invitation) {
      authorize("read", invitation);
    }
    return invitation;
  }

  /**
   * Paginates invitations for the selected workspace after authorization.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated invitations belonging to the workspace.
   */
  async getWorkspaceInvitationConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<WorkspaceInvitation>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<WorkspaceInvitation>> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    authorize("read", WorkspaceInvitation);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<WorkspaceInvitation>(WorkspaceInvitationConnection, args, {
      ...(info && { info }),
      where: { workspace },
    });
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return connection;
  }

  /**
   * Paginates unexpired pending invitations addressed to the current user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated invitations addressed to the user.
   */
  async getWorkspaceInvitationConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<WorkspaceInvitation>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<WorkspaceInvitation>> {
    RequestIdentity.assertUserSession(user);
    const now = new Date();
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<WorkspaceInvitation>(WorkspaceInvitationConnection, args, {
      ...(info && { info }),
      where: {
        email: user.email.toLowerCase(),
        expiresAt: { $gt: now },
        status: "pending",
      },
    });
    return connection;
  }

  /**
   * Accepts a pending invitation and creates an active membership.
   * @param user - The user whose account is being accessed.
   * @param invitationId - Identifier of the invitation to accept.
   * @returns Accepted invitation and its resulting membership.
   */
  async acceptWorkspaceInvitation(
    user: User,
    invitationId: string,
  ): Promise<AcceptWorkspaceInvitationResult | null> {
    RequestIdentity.assertUserSession(user);
    return await this.em.transactional(
      async (em) => {
        const invitation = await em.findOne(
          WorkspaceInvitation,
          { id: invitationId },
          {
            filters: false,
            populate: ["workspace"],
          },
        );
        if (!invitation) {
          return null;
        }
        if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new ForbiddenException(
            "Workspace invitation belongs to another email address",
          );
        }
        // All membership/invitation creation takes the workspace lock first.
        // Refresh the invitation only afterwards so direct addition and deletion
        // cannot race acceptance or acquire these locks in the opposite order.
        const workspace = this.unwrapWorkspaceInvitationWorkspace(invitation);
        await this.lockWorkspace(em, workspace);
        await em.refreshOrFail(invitation, {
          filters: false,
          lockMode: LockMode.PESSIMISTIC_WRITE,
          populate: [],
        });
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
          permissions: [],
          roles: this.normalizeRoles(invitation.roles),
          status: "ACTIVE",
          user,
          workspace,
        });
        invitation.status = "accepted";
        await em.persist(member).flush();
        return { invitation, member };
      },
      { clear: true },
    );
  }

  /**
   * Cancels a pending invitation.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns Canceled invitation.
   */
  async cancelWorkspaceInvitation(
    invitation: WorkspaceInvitation | string,
  ): Promise<WorkspaceInvitation> {
    authorize("write", WorkspaceInvitation);
    invitation = await this.resolveWorkspaceInvitationForAction(invitation);
    const workspace = this.unwrapWorkspaceInvitationWorkspace(invitation);
    RequestIdentity.assertCurrentWorkspace(workspace);
    authorize("write", invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    const updated = await this.em.nativeUpdate(
      WorkspaceInvitation,
      {
        id: invitation.id,
        status: "pending",
        workspace,
      },
      { status: "canceled" },
    );
    if (updated !== 1) {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    invitation.status = "canceled";
    return invitation;
  }

  /**
   * Rejects an invitation after verifying the invited user's email.
   * @param user - The user whose account is being accessed.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns Rejected invitation.
   */
  async rejectWorkspaceInvitation(
    user: User,
    invitation: WorkspaceInvitation | string,
  ): Promise<WorkspaceInvitation> {
    RequestIdentity.assertUserSession(user);
    invitation = await this.resolveWorkspaceInvitationForAction(invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        "Workspace invitation belongs to another email address",
      );
    }
    const updated = await this.em.nativeUpdate(
      WorkspaceInvitation,
      {
        email: user.email.trim().toLowerCase(),
        id: invitation.id,
        status: "pending",
      },
      { status: "rejected" },
    );
    if (updated !== 1) {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    invitation.status = "rejected";
    return invitation;
  }

  private async resolveWorkspaceInvitationForAction(
    invitation: WorkspaceInvitation | string,
  ): Promise<WorkspaceInvitation> {
    if (typeof invitation !== "string") {
      return invitation;
    }
    const entity = await this.em.findOne(
      WorkspaceInvitation,
      { id: invitation },
      { populate: ["workspace"], refresh: true },
    );
    if (!entity) {
      throw new NotFoundException("Workspace invitation not found");
    }
    return entity;
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
      resolveAuthPermissions(roles, [], this.roles),
    );
    return roles;
  }

  private get roles(): AuthModuleRoles {
    return resolveAuthCatalog(this.authOptions, "workspace").roles;
  }

  private get defaultRole(): string {
    return this.authOptions.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE;
  }

  private unwrapWorkspaceInvitationWorkspace(
    invitation: WorkspaceInvitation,
  ): Workspace {
    return Reference.unwrapReference(invitation.workspace);
  }
}
