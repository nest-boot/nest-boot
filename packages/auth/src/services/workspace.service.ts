import {
  EntityManager,
  type FilterQuery,
  LockMode,
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
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { WorkspaceConnection } from "../connections/workspace.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { CreateWorkspaceOptions } from "../interfaces/create-workspace-options.interface.js";
import type { UpdateWorkspaceOptions } from "../interfaces/update-workspace-options.interface.js";
import { clearWorkspaceAuthorization } from "../utils/clear-workspace-authorization.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { DEFAULT_WORKSPACE_CREATOR_ROLE } from "../workspace.constants.js";
import { AccessControlService } from "./access-control.service.js";

/** Workspace queries and lifecycle operations. */
@Injectable()
export class WorkspaceService {
  /** Creates a workspace domain service. */
  constructor(
    /** MikroORM entity manager used for workspace persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Returns the selected workspace after validating its user membership. */
  getCurrentWorkspace(): Workspace | null {
    if (!RequestContext.isActive()) return null;
    const workspace = RequestContext.get(Workspace);
    const user = RequestContext.get(User);
    const member = this.resolveCurrentMember();
    if (user && workspace && !member) {
      throw new ForbiddenException(
        "The authenticated user is not a member of this workspace",
      );
    }
    return workspace ?? null;
  }

  /** Returns the current member, rejecting user API keys outside their membership. */
  private resolveCurrentMember(): Member | null {
    if (!RequestContext.isActive()) return null;
    const member = RequestContext.get(Member);
    if (getCurrentApiKey() && RequestContext.get(User) && !member) {
      throw new ForbiddenException(
        "The API key owner is not a member of this workspace",
      );
    }
    return member ?? null;
  }

  /** Finds a workspace only when the current user is an active member. */
  async getUserWorkspace(id: string, user: User): Promise<Workspace | null> {
    this.accessControlService.assertCurrentUser(user);
    const workspace = await this.findOne({ id } as FilterQuery<Workspace>);
    if (!workspace) return null;
    return (await this.findActiveMemberByUser(workspace, user))
      ? workspace
      : null;
  }

  /** Paginates workspaces belonging to the current user's active memberships. */
  async getWorkspaceConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Workspace>,
  ): Promise<ConnectionInterface<Workspace>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", Workspace);
    const memberships = (this.em as SqlEntityManager)
      .createQueryBuilder<Member>(Member)
      .select("workspace")
      .where({ status: "ACTIVE", user: user.id });
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Workspace>(WorkspaceConnection, args, {
      where: {
        id: { $in: memberships.toRaw() },
      } as unknown as FilterQuery<Workspace>,
    });
  }

  /** Finds a workspace matching the supplied filter. */
  async findOne(where: FilterQuery<Workspace>): Promise<Workspace | null> {
    this.accessControlService.assertUserCan("read", Workspace);
    return await this.em.findOne(Workspace, where);
  }

  /** Creates a workspace and its owner membership atomically. */
  async createWorkspace(
    user: User,
    input: CreateWorkspaceOptions,
  ): Promise<Workspace> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("create", Workspace);
    // The new workspace has no request session yet. Only this authorized
    // operation may bootstrap its owner outside the application's RLS scope.
    return await this.em.transactional(
      async (em) => {
        const workspace = em.create(Workspace, {
          name: input.name,
        } as unknown as RequiredEntityData<Workspace>);
        const member = em.create(Member, {
          name: user.name,
          email: user.email.trim().toLowerCase(),
          roles: [this.creatorRole],
          status: "ACTIVE",
          // Do not attach the caller's potentially dirty user to this fork.
          user: user.id,
          workspace,
        } as unknown as RequiredEntityData<Member>);

        await em.persist(workspace).persist(member).flush();
        return workspace;
      },
      { clear: true },
    );
  }

  private async resolveWorkspaceForAction(
    workspace: Workspace | string,
    action: string,
  ): Promise<Workspace> {
    if (typeof workspace !== "string") return workspace;
    this.accessControlService.assertWorkspaceCan(action, Workspace);
    const entity = await this.em.findOne(
      Workspace,
      { id: workspace } as FilterQuery<Workspace>,
      { refresh: true },
    );
    if (!entity) throw new NotFoundException("Workspace not found");
    return entity;
  }

  /** Updates mutable workspace fields. */
  async updateWorkspace(
    workspace: Workspace | string,
    input: UpdateWorkspaceOptions,
  ): Promise<Workspace> {
    workspace = await this.resolveWorkspaceForAction(workspace, "update");
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("update", workspace);
    this.em.assign(workspace, input as never, { ignoreUndefined: true });
    await this.em.flush();
    return workspace;
  }

  /** Permanently deletes a workspace and cascades its dependent authentication records. */
  async deleteWorkspace(workspace: Workspace | string): Promise<Workspace> {
    workspace = await this.resolveWorkspaceForAction(workspace, "delete");
    this.accessControlService.assertCurrentWorkspace(workspace);
    this.accessControlService.assertWorkspaceCan("delete", workspace);
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Delete the workspace outside an active transaction",
      );
    }

    await this.em.transactional(
      async (em) => {
        await this.lockWorkspace(em, workspace);
        this.accessControlService.assertWorkspaceCan("delete", workspace);
        const count = await em.nativeDelete(Workspace, {
          id: workspace.id,
        } as FilterQuery<Workspace>);
        if (count !== 1) throw new NotFoundException("Workspace not found");
      },
      { clear: true },
    );
    clearWorkspaceAuthorization(this.em);
    return workspace;
  }

  /** Finds the active membership linking a user and workspace. */
  private async findActiveMemberByUser(
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

  private get creatorRole(): string {
    return (
      this.authOptions.workspace?.creatorRole ?? DEFAULT_WORKSPACE_CREATOR_ROLE
    );
  }
}
