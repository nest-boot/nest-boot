import {
  EntityManager,
  type FilterQuery,
  LockMode,
  Reference,
  type RequiredEntityData,
  UniqueConstraintViolationException,
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
import { InvitationConnection } from "../connections/invitation.connection-definition.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { AcceptInvitationResult } from "../interfaces/accept-invitation-result.interface.js";
import type { CreateInvitationOptions } from "../interfaces/create-invitation-options.interface.js";
import type { AuthInvitationEmailInviter } from "../types/auth-invitation-email-inviter.type.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import {
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "../utils/auth-role.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { DEFAULT_WORKSPACE_ROLE } from "../workspace.constants.js";
import { AccessControlService } from "./access-control.service.js";

/** Workspace invitation queries and lifecycle operations. */
@Injectable()
export class InvitationService {
  /** Creates a workspace invitation domain service. */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Creates a pending workspace invitation. */
  async createInvitation(
    workspace: Workspace,
    inviter: User,
    input: CreateInvitationOptions,
    request?: Request,
  ): Promise<Invitation> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertCurrentUser(inviter);
    this.accessControlService.assertWorkspaceCan("create", Invitation);
    const email = input.email.trim().toLowerCase();
    const roles = this.normalizeGrantedRoles(input.roles ?? [this.defaultRole]);
    const expiresIn = input.expiresIn ?? 60 * 60 * 48;
    if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
      throw new BadRequestException(
        "Workspace invitation lifetime must be a positive integer",
      );
    }
    const sendInvitationEmail = this.authOptions.workspace?.sendInvitationEmail;
    if (sendInvitationEmail && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Create invitations with email delivery outside an active transaction",
      );
    }
    let transactionResult: {
      created: Invitation;
      inviterMember: Member | null;
    };

    try {
      transactionResult = await this.em.transactional(
        async (em) => {
          await this.lockWorkspace(em, workspace);
          const now = new Date();
          const userId = await this.getUserIdForInvitation(
            workspace,
            inviter,
            email,
          );
          const [member, invitation, inviterMember] = await Promise.all([
            userId
              ? em.findOne(
                  Member,
                  { workspace, user: userId } as FilterQuery<Member>,
                  { filters: false },
                )
              : Promise.resolve(null),
            em.findOne(
              Invitation,
              {
                email,
                status: "pending",
                workspace,
              } as FilterQuery<Invitation>,
              { filters: false },
            ),
            sendInvitationEmail
              ? em.findOne(
                  Member,
                  {
                    status: "ACTIVE",
                    user: inviter,
                    workspace,
                  } as FilterQuery<Member>,
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
          if (invitation) {
            invitation.status = "canceled";
            await em.flush();
          }

          const created = em.create(Invitation, {
            email,
            expiresAt: new Date(now.getTime() + expiresIn * 1000),
            inviter,
            roles,
            status: "pending",
            workspace,
          } as unknown as RequiredEntityData<Invitation>);
          this.accessControlService.assertWorkspaceCan("create", created);
          await em.persist(created).flush();
          return { created, inviterMember };
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

    const { created, inviterMember } = transactionResult;

    if (sendInvitationEmail && inviterMember) {
      const callbackInviter = Object.assign(
        Object.create(Object.getPrototypeOf(inviterMember)) as Member,
        inviterMember,
        { user: inviter },
      ) as unknown as AuthInvitationEmailInviter;

      try {
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
      } catch (error) {
        await this.em.nativeUpdate(
          Invitation,
          {
            id: created.id,
            status: "pending",
          } as FilterQuery<Invitation>,
          { status: "canceled" } as never,
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
   * @internal
   */
  async getUserIdForInvitation(
    workspace: Workspace,
    inviter: User,
    email: string,
  ): Promise<string | null> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertCurrentUser(inviter);
    this.accessControlService.assertWorkspaceCan("create", Invitation);
    const user = await this.em.findOne(
      User,
      { email: email.trim().toLowerCase() } as FilterQuery<User>,
      { fields: ["id"] as never, filters: false },
    );
    return user ? String(user.id) : null;
  }

  /** Finds an invitation after recipient or workspace authorization, preserving RLS. */
  async getInvitation(id: string): Promise<Invitation | null> {
    if (
      !this.accessControlService.userCan("read", Invitation) &&
      !this.accessControlService.workspaceCan("read", Invitation)
    ) {
      throw new ForbiddenException("Invitation read access denied");
    }
    const invitation = await this.em.findOne(
      Invitation,
      { id } as FilterQuery<Invitation>,
      { refresh: true },
    );
    if (invitation) this.assertInvitationReadAccess(invitation);
    return invitation;
  }

  /** Resolves the inviter through an authorized invitation without bypassing RLS. */
  async getInvitationInviter(invitation: Invitation): Promise<User> {
    const current = await this.getInvitationForRelation(invitation);
    const actor = RequestContext.isActive() ? RequestContext.get(User) : null;
    const self = actor?.id === current.inviter.id;
    if (!self) this.accessControlService.assertUserCan("read", User);
    const user = await this.em.findOne(
      User,
      { id: current.inviter.id } as FilterQuery<User>,
      { refresh: true },
    );
    if (!user) throw new NotFoundException("Invitation inviter not found");
    if (!self) this.accessControlService.assertUserCan("read", user);
    return user;
  }

  /** Resolves the workspace through an authorized invitation without requiring membership. */
  async getInvitationWorkspace(invitation: Invitation): Promise<Workspace> {
    const current = await this.getInvitationForRelation(invitation);
    const workspace = await this.em.findOne(
      Workspace,
      { id: current.workspace.id } as FilterQuery<Workspace>,
      { refresh: true },
    );
    if (!workspace)
      throw new NotFoundException("Invitation workspace not found");
    return workspace;
  }

  private async getInvitationForRelation(
    invitation: Invitation,
  ): Promise<Invitation> {
    this.assertInvitationReadAccess(invitation);
    // Re-read through this manager: a mutation may return entities/references
    // hydrated by the isolated authentication context, or an older identity.
    const current = await this.em.findOne(
      Invitation,
      { id: invitation.id } as FilterQuery<Invitation>,
      { refresh: true },
    );
    if (!current) throw new NotFoundException("Workspace invitation not found");
    this.assertInvitationReadAccess(current);
    return current;
  }

  private assertInvitationReadAccess(invitation: Invitation): void {
    const user = RequestContext.isActive() ? RequestContext.get(User) : null;
    if (
      invitation.email.toLowerCase() === user?.email?.toLowerCase() &&
      this.accessControlService.userCan("read", invitation)
    ) {
      return;
    }
    this.accessControlService.assertCurrentWorkspace(
      this.unwrapInvitationWorkspace(invitation),
    );
    this.accessControlService.assertWorkspaceCan("read", invitation);
  }

  /** Finds an invitation when it is addressed to the supplied user. */
  async getInvitationByUser(
    id: string,
    user: User,
  ): Promise<Invitation | null> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", Invitation);
    const invitation = await this.em.findOne(Invitation, {
      id,
      email: user.email.toLowerCase(),
    } as FilterQuery<Invitation>);
    if (invitation) this.accessControlService.assertUserCan("read", invitation);
    return invitation;
  }

  /** Finds an invitation owned by the supplied workspace. */
  async getInvitationByWorkspace(
    id: string,
    workspace: Workspace,
  ): Promise<Invitation | null> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("read", Invitation);
    const invitation = await this.em.findOne(Invitation, {
      id,
      workspace,
    } as FilterQuery<Invitation>);
    if (invitation)
      this.accessControlService.assertWorkspaceCan("read", invitation);
    return invitation;
  }

  /** Paginates invitations for the selected workspace after authorization. */
  async getInvitationConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<Invitation>,
  ): Promise<ConnectionInterface<Invitation>> {
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("read", Invitation);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Invitation>(InvitationConnection, args, {
      where: { workspace } as FilterQuery<Invitation>,
    });
    for (const { node } of connection.edges) {
      this.accessControlService.assertWorkspaceCan("read", node);
    }
    return connection;
  }

  /** Paginates unexpired pending invitations addressed to the current user. */
  async getInvitationConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Invitation>,
  ): Promise<ConnectionInterface<Invitation>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", Invitation);
    const now = new Date();
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Invitation>(InvitationConnection, args, {
      where: {
        email: user.email.toLowerCase(),
        expiresAt: { $gt: now },
        status: "pending",
      } as FilterQuery<Invitation>,
    });
    for (const { node } of connection.edges) {
      this.accessControlService.assertUserCan("read", node);
    }
    return connection;
  }

  /** Accepts a pending invitation and creates an active membership. */
  async acceptInvitation(
    user: User,
    invitationId: string,
  ): Promise<AcceptInvitationResult | null> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("update", Invitation);
    return await this.em.transactional(
      async (em) => {
        const invitation = await em.findOne(
          Invitation,
          { id: invitationId } as FilterQuery<Invitation>,
          {
            filters: false,
            populate: ["workspace"] as never,
          },
        );
        if (!invitation) return null;
        if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new ForbiddenException(
            "Workspace invitation belongs to another email address",
          );
        }
        // All membership/invitation creation takes the workspace lock first.
        // Refresh the invitation only afterwards so direct addition and deletion
        // cannot race acceptance or acquire these locks in the opposite order.
        const workspace = this.unwrapInvitationWorkspace(invitation);
        await this.lockWorkspace(em, workspace);
        await em.refreshOrFail(invitation, {
          filters: false,
          lockMode: LockMode.PESSIMISTIC_WRITE,
          populate: [],
        });
        this.accessControlService.assertUserCan("update", invitation);
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
          Member,
          { user, workspace } as FilterQuery<Member>,
          { filters: false },
        );
        if (existing) throw new ConflictException("User is already a member");

        const member = em.create(Member, {
          name: user.name,
          email: user.email.trim().toLowerCase(),
          permissions: [],
          roles: this.normalizeRoles(invitation.roles),
          status: "ACTIVE",
          user,
          workspace,
        } as unknown as RequiredEntityData<Member>);
        invitation.status = "accepted";
        await em.persist(member).flush();
        return { invitation, member };
      },
      { clear: true },
    );
  }

  /** Cancels a pending invitation. */
  async cancelInvitation(invitation: Invitation | string): Promise<Invitation> {
    this.accessControlService.assertWorkspaceCan("cancel", Invitation);
    invitation = await this.resolveInvitationForAction(invitation);
    const workspace = this.unwrapInvitationWorkspace(invitation);
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("cancel", invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    const updated = await this.em.nativeUpdate(
      Invitation,
      {
        id: invitation.id,
        status: "pending",
        workspace,
      } as FilterQuery<Invitation>,
      { status: "canceled" } as never,
    );
    if (updated !== 1) {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    invitation.status = "canceled";
    return invitation;
  }

  /** Rejects an invitation after verifying the invited user's email. */
  async rejectInvitation(
    user: User,
    invitation: Invitation | string,
  ): Promise<Invitation> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("update", Invitation);
    invitation = await this.resolveInvitationForAction(invitation);
    this.accessControlService.assertUserCan("update", invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        "Workspace invitation belongs to another email address",
      );
    }
    const updated = await this.em.nativeUpdate(
      Invitation,
      {
        email: user.email.trim().toLowerCase(),
        id: invitation.id,
        status: "pending",
      } as FilterQuery<Invitation>,
      { status: "rejected" } as never,
    );
    if (updated !== 1) {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    invitation.status = "rejected";
    return invitation;
  }

  private async resolveInvitationForAction(
    invitation: Invitation | string,
  ): Promise<Invitation> {
    if (typeof invitation !== "string") return invitation;
    const entity = await this.em.findOne(
      Invitation,
      { id: invitation } as FilterQuery<Invitation>,
      { populate: ["workspace"] as never, refresh: true },
    );
    if (!entity) throw new NotFoundException("Workspace invitation not found");
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
    this.accessControlService.assertCanGrantWorkspacePermissions(
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

  private unwrapInvitationWorkspace(invitation: Invitation): Workspace {
    return Reference.unwrapReference(
      invitation.workspace,
    ) as unknown as Workspace;
  }
}
