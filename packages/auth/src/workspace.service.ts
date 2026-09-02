import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  type RequiredEntityData,
} from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type {
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";

/** Input accepted when creating a workspace. */
export interface CreateWorkspaceOptions {
  /** Workspace display name. */
  name: string;
}

/** Input accepted when updating a workspace. */
export interface UpdateWorkspaceOptions {
  /** New workspace display name. */
  name?: string;
}

/** Domain service for workspace lifecycle operations. */
@Injectable()
export class WorkspaceService<
  Workspace extends BaseWorkspace = BaseWorkspace,
  WorkspaceMember extends BaseWorkspaceMember = BaseWorkspaceMember,
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
      currentWorkspaceMember.workspace.id !== workspace.id
    ) {
      throw new ForbiddenException("Only workspace owners can delete it");
    }

    return await this.withRlsDisabled(async () => {
      this.em.assign(workspace, { deletedAt: new Date() } as never);
      await this.em.flush();

      return workspace;
    });
  }

  private get workspaceEntity(): EntityClass<Workspace> {
    return this.authOptions.entities.workspace as EntityClass<Workspace>;
  }

  private get workspaceMemberEntity(): EntityClass<WorkspaceMember> {
    return this.authOptions.entities
      .workspaceMember as EntityClass<WorkspaceMember>;
  }

  private async withRlsDisabled<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) {
      return await RequestContext.child(run);
    }

    return await RequestContext.run(
      new RequestContext({ type: "auth-workspace" }),
      run,
    );
  }
}
