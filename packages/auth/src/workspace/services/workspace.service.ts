import {
  EntityManager,
  type FilterQuery,
  LockMode,
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

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { authorize } from "../../common/utils/authorize.util.js";
import { generateUrlIdentifier } from "../../common/utils/generate-url-identifier.util.js";
import { runAuthQuery } from "../../common/utils/run-auth-query.js";
import { urlIdentifierSchema } from "../../common/utils/url-identifier.util.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import { AuthContext } from "../../core/auth-context.js";
import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import {
  assertCurrentUser,
  assertCurrentWorkspace,
  assertUserSession,
} from "../../core/utils/assert-current-identity.util.js";
import { WorkspaceConnection } from "../connections/workspace.connection-definition.js";
import { DEFAULT_WORKSPACE_CREATOR_ROLE } from "../constants/workspace.constants.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import type { CreateWorkspaceOptions } from "../interfaces/create-workspace-options.interface.js";
import type { UpdateWorkspaceOptions } from "../interfaces/update-workspace-options.interface.js";
import { getCurrentWorkspaceMember } from "../utils/get-current-workspace-member.util.js";

/** Workspace queries and lifecycle operations. */
@Injectable()
export class WorkspaceService {
  /**
   * Creates a workspace domain service.
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
   * Lists every workspace after an explicit platform read grant.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @returns Page of workspaces authorized for platform access.
   */
  async getPlatformWorkspaceConnection(
    args: ConnectionArgsInterface<Workspace>,
  ): Promise<ConnectionResult<Workspace>> {
    authorize("read-any", Workspace);
    return await runAuthQuery(this.em, async (em) => {
      const page = await new ConnectionManager(em as SqlEntityManager).find(
        WorkspaceConnection,
        args,
        { where: {} },
      );
      for (const { node } of page.edges) {
        authorize("read-any", node);
      }
      return page;
    });
  }

  /**
   * Reads a workspace without requiring a membership or selected workspace.
   * @param id - Identifier of the target record.
   * @returns Authorized workspace, or null when it is unavailable.
   */
  async getPlatformWorkspace(id: string): Promise<Workspace | null> {
    authorize("read-any", Workspace);
    return await runAuthQuery(this.em, async (em) => {
      const workspace = await em.findOne(Workspace, { id });
      if (workspace) {
        authorize("read-any", workspace);
      }
      return workspace;
    });
  }

  /**
   * Updates a named workspace through the separate platform permission boundary.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Persisted workspace after the platform-authorized change.
   */
  async updatePlatformWorkspace(
    id: string,
    input: UpdateWorkspaceOptions,
  ): Promise<Workspace> {
    authorize("update-any", Workspace);
    input = this.normalizeWorkspaceChanges(input);
    this.assertCurrentWorkspaceCanChange(id);
    const workspace = await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const workspace = await tx.findOne(
            Workspace,
            { id },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!workspace) {
            throw new NotFoundException("Workspace not found");
          }
          authorize("update-any", workspace);
          // Conditional field rules must see the original record as well.
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("update-any", workspace, field);
            }
          }
          tx.assign(workspace, input, { ignoreUndefined: true });
          authorize("update-any", workspace);
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("update-any", workspace, field);
            }
          }
          await tx.flush();
          return workspace;
        },
        { clear: true },
      ),
    ).catch((error: unknown) => {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException("Workspace slug is already taken");
      }
      throw error;
    });
    if (
      RequestContext.isActive() &&
      RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)?.id === id
    ) {
      this.authContext.set({ workspace });
    }
    return workspace;
  }

  /**
   * Deletes a named workspace using platform authorization and database cascades.
   * @param id - Identifier of the target record.
   * @returns Metadata of the deleted workspace.
   */
  async deletePlatformWorkspace(id: string): Promise<Workspace> {
    authorize("delete-any", Workspace);
    this.assertCurrentWorkspaceCanChange(id);
    const workspace = await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const workspace = await tx.findOne(
            Workspace,
            { id },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!workspace) {
            throw new NotFoundException("Workspace not found");
          }
          authorize("delete-any", workspace);
          await tx.nativeDelete(Workspace, { id });
          return workspace;
        },
        { clear: true },
      ),
    );
    if (
      RequestContext.isActive() &&
      RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)?.id === id
    ) {
      this.authContext.clearWorkspace();
    }
    return workspace;
  }

  /**
   * Returns the selected workspace after membership and instance read checks.
   * @returns Selected workspace, or null when none is available.
   */
  getCurrentWorkspace(): Workspace | null {
    if (!RequestContext.isActive()) {
      return null;
    }
    const workspace = RequestContext.get<Workspace | null>(SELECTED_WORKSPACE);
    const user = RequestContext.get(User);
    const member = getCurrentWorkspaceMember();
    if (user && workspace && !member) {
      throw new ForbiddenException(
        "The authenticated user is not a member of this workspace",
      );
    }
    if (workspace) {
      authorize(
        getCurrentApiKey()?.ownerType === "system_account"
          ? "read-any"
          : "read",
        workspace,
      );
    }
    return workspace ?? null;
  }

  private assertCurrentWorkspaceCanChange(id: string): void {
    if (
      RequestContext.isActive() &&
      RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)?.id === id &&
      this.em.isInTransaction()
    ) {
      throw new BadRequestException(
        "Change the current workspace outside an active transaction",
      );
    }
  }

  /**
   * Finds a workspace only when the current user is an active member.
   * @param id - Identifier of the record to access.
   * @param user - The user whose account is being accessed.
   * @returns Workspace when the user has an active membership, otherwise null.
   */
  async getUserWorkspace(id: string, user: User): Promise<Workspace | null> {
    return await this.findUserWorkspace({ id }, user);
  }

  /**
   * Finds a workspace by slug using the same access rules as lookup by ID.
   * @param slug - Workspace URL slug.
   * @param user - The user whose account is being accessed.
   * @returns Accessible workspace or null.
   */
  async getUserWorkspaceBySlug(
    slug: string,
    user: User,
  ): Promise<Workspace | null> {
    const parsed = urlIdentifierSchema.safeParse(slug);
    if (!parsed.success) {
      throw new BadRequestException("Invalid workspace slug");
    }
    return await this.findUserWorkspace({ slug: parsed.data }, user);
  }

  /**
   * Checks whether a workspace already uses a slug.
   * @param slug - Requested workspace slug.
   * @param user - Authenticated user making the request.
   * @returns Whether a workspace already uses the slug.
   */
  async slugExists(slug: string, user: User): Promise<boolean> {
    assertCurrentUser(user);
    authorize("create", Workspace);
    const parsed = urlIdentifierSchema.safeParse(slug);
    if (!parsed.success) {
      throw new BadRequestException("Invalid workspace slug");
    }
    return (await this.em.count(Workspace, { slug: parsed.data })) > 0;
  }

  private async findUserWorkspace(
    where: FilterQuery<Workspace>,
    user: User,
  ): Promise<Workspace | null> {
    assertCurrentUser(user);
    if (getCurrentApiKey()) {
      return await this.findOne(where);
    }
    assertUserSession(user);
    const workspace = await this.em.findOne(Workspace, where);
    if (!workspace) {
      return null;
    }
    return (await this.findActiveWorkspaceMemberByUser(workspace, user))
      ? workspace
      : null;
  }

  /**
   * Paginates workspaces belonging to the current user's active memberships.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @returns Paginated workspaces joined by the user.
   */
  async getWorkspaceConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Workspace>,
  ): Promise<ConnectionResult<Workspace>> {
    assertUserSession(user);
    const memberships = (this.em as SqlEntityManager)
      .createQueryBuilder<WorkspaceMember>(WorkspaceMember)
      .select("workspace")
      .where({ status: "ACTIVE", user: user.id });
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Workspace>(WorkspaceConnection, args, {
      where: {
        id: { $in: memberships.toRaw() },
      },
    });
    return connection;
  }

  /**
   * Finds the selected workspace matching the supplied filter and read ability.
   * @param where - Conditions to translate into a database filter.
   * @returns Accessible workspace, or null if it is unavailable.
   */
  async findOne(where: FilterQuery<Workspace>): Promise<Workspace | null> {
    const current = RequestContext.isActive()
      ? RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)
      : null;
    if (!current) {
      throw new ForbiddenException("A workspace must be selected");
    }
    assertCurrentWorkspace(current);
    authorize("read", current);
    const workspace = await this.em.findOne(Workspace, {
      $and: [where, { id: current.id }],
    });
    if (workspace) {
      authorize("read", workspace);
    }
    return workspace;
  }

  /**
   * Creates a workspace and its owner membership atomically.
   * @param user - The user whose account is being accessed.
   * @param input - Requested field values for the operation.
   * @returns Persisted workspace.
   */
  async createWorkspace(
    user: User,
    input: CreateWorkspaceOptions,
  ): Promise<Workspace> {
    return await runAuthQuery(this.em, async (em) => {
      assertCurrentUser(user);
      authorize("create", Workspace);
      const parsed = urlIdentifierSchema.optional().safeParse(input.slug);
      if (!parsed.success) {
        throw new BadRequestException("Invalid workspace slug");
      }
      // The new workspace has no request session yet. Only this authorized
      // operation may bootstrap its owner outside the application's RLS scope.
      try {
        return await em.transactional(
          async (em) => {
            const workspace = em.create(Workspace, {
              name: input.name,
              slug: parsed.data ?? generateUrlIdentifier(),
            });
            authorize("create", workspace);
            const member = em.create(WorkspaceMember, {
              name: user.name,
              email: user.email.trim().toLowerCase(),
              roles: [this.creatorRole],
              status: "ACTIVE",
              // Do not attach the caller's potentially dirty user to this fork.
              user: user.id,
              workspace,
            });

            await em.persist(workspace).persist(member).flush();
            return workspace;
          },
          { clear: true },
        );
      } catch (error) {
        if (error instanceof UniqueConstraintViolationException) {
          throw new ConflictException("Workspace slug is already taken");
        }
        throw error;
      }
    });
  }

  private async resolveWorkspaceForAction(
    workspace: Workspace | string,
    action: string,
  ): Promise<Workspace> {
    if (typeof workspace !== "string") {
      return workspace;
    }
    authorize(action, Workspace);
    const entity = await this.em.findOne(
      Workspace,
      { id: workspace },
      { refresh: true },
    );
    if (!entity) {
      throw new NotFoundException("Workspace not found");
    }
    return entity;
  }

  /**
   * Updates mutable workspace fields.
   * @param workspace - The workspace that scopes this operation.
   * @param input - Requested field values for the operation.
   * @returns Workspace after the requested changes.
   */
  async updateWorkspace(
    workspace: Workspace | string,
    input: UpdateWorkspaceOptions,
  ): Promise<Workspace> {
    workspace = await this.resolveWorkspaceForAction(workspace, "update");
    assertCurrentWorkspace(workspace);
    authorize("update", workspace);
    input = this.normalizeWorkspaceChanges(input);
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Change the current workspace outside an active transaction",
      );
    }
    const id = workspace.id;
    try {
      workspace = await this.em.transactional(
        async (em) => {
          // Check and write the same locked, transaction-managed record.
          const entity = await em.findOne(
            Workspace,
            { id },
            {
              refresh: true,
              lockMode: LockMode.PESSIMISTIC_WRITE,
            },
          );
          if (!entity) {
            throw new NotFoundException("Workspace not found");
          }
          authorize("update", entity);
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("update", entity, field);
            }
          }
          em.assign(entity, input, { ignoreUndefined: true });
          authorize("update", entity);
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("update", entity, field);
            }
          }
          await em.flush();
          return entity;
        },
        { clear: true },
      );
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException("Workspace slug is already taken");
      }
      throw error;
    }
    if (RequestContext.isActive()) {
      this.authContext.set({ workspace });
    }
    return workspace;
  }

  private normalizeWorkspaceChanges(
    input: UpdateWorkspaceOptions,
  ): UpdateWorkspaceOptions {
    if (input.slug === undefined) {
      return input;
    }
    const parsed = urlIdentifierSchema.safeParse(input.slug);
    if (!parsed.success) {
      throw new BadRequestException("Invalid workspace slug");
    }
    return { ...input, slug: parsed.data };
  }

  /**
   * Permanently deletes a workspace and cascades its dependent authentication records.
   * @param workspace - The workspace that scopes this operation.
   * @returns Metadata of the deleted workspace.
   */
  async deleteWorkspace(workspace: Workspace | string): Promise<Workspace> {
    workspace = await this.resolveWorkspaceForAction(workspace, "delete");
    assertCurrentWorkspace(workspace);
    authorize("delete", workspace);

    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Delete the workspace outside an active transaction",
      );
    }
    await this.em.transactional(
      async (em) => {
        await this.lockWorkspace(em, workspace);
        authorize("delete", workspace);
        const count = await em.nativeDelete(Workspace, {
          id: workspace.id,
        });
        if (count !== 1) {
          throw new NotFoundException("Workspace not found");
        }
      },
      { clear: true },
    );
    this.authContext.clearWorkspace();
    return workspace;
  }

  /**
   * Finds the active membership linking a user and workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param user - The user whose account is being accessed.
   * @returns Active membership for the user and workspace, or null.
   */
  private async findActiveWorkspaceMemberByUser(
    workspace: Workspace,
    user: User,
  ): Promise<WorkspaceMember | null> {
    assertUserSession(user);
    return await this.em.findOne(WorkspaceMember, {
      status: "ACTIVE",
      user,
      workspace,
    });
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
