import {
  EntityManager,
  LockMode,
  Reference,
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
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { AcceptInvitationResult } from "../interfaces/accept-invitation-result.interface.js";
import type { CreateInvitationOptions } from "../interfaces/create-invitation-options.interface.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import { assertCan } from "../utils/assert-can.util.js";
import {
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "../utils/auth-role.util.js";
import { can } from "../utils/can.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { assertCanGrantPermissions } from "../utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { DEFAULT_WORKSPACE_ROLE } from "../workspace.constants.js";

/** Workspace invitation queries and lifecycle operations. */
@Injectable()
export class InvitationService {
  /** Creates a workspace invitation domain service. */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Creates a pending workspace invitation. */
  async createInvitation(
    workspace: Workspace,
    inviter: User,
    input: CreateInvitationOptions,
    request?: Request,
  ): Promise<Invitation> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    RequestIdentity.assertCurrentUser(inviter);
    assertCan("write", Invitation);
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
                  { workspace, user: userId },
                  { filters: false },
                )
              : Promise.resolve(null),
            em.findOne(
              Invitation,
              {
                email,
                status: "pending",
                workspace,
              },
              { filters: false },
            ),
            sendInvitationEmail
              ? em.findOne(
                  Member,
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
          });
          assertCan("write", created);
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
      );

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
   * @internal
   */
  async getUserIdForInvitation(
    workspace: Workspace,
    inviter: User,
    email: string,
  ): Promise<string | null> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    RequestIdentity.assertCurrentUser(inviter);
    assertCan("write", Invitation);
    const user = await this.em.findOne(
      User,
      { email: email.trim().toLowerCase() },
      { fields: ["id"], filters: false },
    );
    return user ? String(user.id) : null;
  }

  /** Finds an invitation after recipient or workspace authorization, preserving RLS. */
  async getInvitation(id: string): Promise<Invitation | null> {
    const recipientSession =
      RequestContext.isActive() &&
      RequestContext.get(User) &&
      !getCurrentApiKey();
    if (!recipientSession && !can("read", Invitation)) {
      throw new ForbiddenException("Invitation read access denied");
    }
    const invitation = await this.em.findOne(
      Invitation,
      { id },
      { refresh: true },
    );
    if (invitation) this.assertInvitationReadAccess(invitation);
    return invitation;
  }

  /** Resolves the inviter through an authorized invitation without bypassing RLS. */
  async getInvitationInviter(invitation: Invitation): Promise<User> {
    const current = await this.getInvitationForRelation(invitation);
    const actor = RequestContext.isActive() ? RequestContext.get(User) : null;
    const self = !getCurrentApiKey() && actor?.id === current.inviter.id;
    if (!self) assertCan("read", User);
    const user = await this.em.findOne(
      User,
      { id: current.inviter.id },
      { refresh: true },
    );
    if (!user) throw new NotFoundException("Invitation inviter not found");
    if (!self) assertCan("read", user);
    return user;
  }

  /** Resolves the workspace through an authorized invitation without requiring membership. */
  async getInvitationWorkspace(invitation: Invitation): Promise<Workspace> {
    const current = await this.getInvitationForRelation(invitation);
    const workspace = await this.em.findOne(
      Workspace,
      { id: current.workspace.id },
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
      { id: invitation.id },
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
      !getCurrentApiKey()
    ) {
      return;
    }
    RequestIdentity.assertCurrentWorkspace(
      this.unwrapInvitationWorkspace(invitation),
    );
    assertCan("read", invitation);
  }

  /** Finds an invitation when it is addressed to the supplied user. */
  async getInvitationByUser(
    id: string,
    user: User,
  ): Promise<Invitation | null> {
    RequestIdentity.assertUserSession(user);
    const invitation = await this.em.findOne(Invitation, {
      id,
      email: user.email.toLowerCase(),
    });
    return invitation;
  }

  /** Finds an invitation owned by the supplied workspace. */
  async getInvitationByWorkspace(
    id: string,
    workspace: Workspace,
  ): Promise<Invitation | null> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    assertCan("read", Invitation);
    const invitation = await this.em.findOne(Invitation, {
      id,
      workspace,
    });
    if (invitation) assertCan("read", invitation);
    return invitation;
  }

  /** Paginates invitations for the selected workspace after authorization. */
  async getInvitationConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<Invitation>,
  ): Promise<ConnectionInterface<Invitation>> {
    RequestIdentity.assertCurrentWorkspace(workspace);
    assertCan("read", Invitation);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Invitation>(InvitationConnection, args, {
      where: { workspace },
    });
    for (const { node } of connection.edges) {
      assertCan("read", node);
    }
    return connection;
  }

  /** Paginates unexpired pending invitations addressed to the current user. */
  async getInvitationConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Invitation>,
  ): Promise<ConnectionInterface<Invitation>> {
    RequestIdentity.assertUserSession(user);
    const now = new Date();
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Invitation>(InvitationConnection, args, {
      where: {
        email: user.email.toLowerCase(),
        expiresAt: { $gt: now },
        status: "pending",
      },
    });
    return connection;
  }

  /** Accepts a pending invitation and creates an active membership. */
  async acceptInvitation(
    user: User,
    invitationId: string,
  ): Promise<AcceptInvitationResult | null> {
    RequestIdentity.assertUserSession(user);
    return await this.em.transactional(
      async (em) => {
        const invitation = await em.findOne(
          Invitation,
          { id: invitationId },
          {
            filters: false,
            populate: ["workspace"],
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
          { user, workspace },
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
        });
        invitation.status = "accepted";
        await em.persist(member).flush();
        return { invitation, member };
      },
      { clear: true },
    );
  }

  /** Cancels a pending invitation. */
  async cancelInvitation(invitation: Invitation | string): Promise<Invitation> {
    assertCan("write", Invitation);
    invitation = await this.resolveInvitationForAction(invitation);
    const workspace = this.unwrapInvitationWorkspace(invitation);
    RequestIdentity.assertCurrentWorkspace(workspace);
    assertCan("write", invitation);
    if (invitation.status !== "pending") {
      throw new BadRequestException("Workspace invitation is not pending");
    }
    const updated = await this.em.nativeUpdate(
      Invitation,
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

  /** Rejects an invitation after verifying the invited user's email. */
  async rejectInvitation(
    user: User,
    invitation: Invitation | string,
  ): Promise<Invitation> {
    RequestIdentity.assertUserSession(user);
    invitation = await this.resolveInvitationForAction(invitation);
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
      },
      { status: "rejected" },
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
      { id: invitation },
      { populate: ["workspace"], refresh: true },
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

  private unwrapInvitationWorkspace(invitation: Invitation): Workspace {
    return Reference.unwrapReference(invitation.workspace);
  }
}
