import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  LockMode,
  Reference,
} from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { runAuthQuery } from "./utils/run-auth-query.js";
import { DEFAULT_WORKSPACE_CREATOR_ROLE } from "./workspace.constants.js";

/** Raised when deleting a user would leave an active workspace without an owner. */
export class WorkspaceOwnershipConflictError extends Error {
  /** Creates the ownership conflict error. */
  constructor() {
    super("Transfer or delete owned workspaces before deleting the user");
    this.name = WorkspaceOwnershipConflictError.name;
  }
}

/** Coordinates transactional deletion of users and auth-owned dependants. */
@Injectable()
export class UserDeletionService {
  /** Creates the internal user-deletion coordinator. */
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {}

  /** Deletes one user and all auth-owned dependent records atomically. */
  async deleteUser(
    userId: string,
    beforeDelete?: () => Promise<void>,
  ): Promise<BaseUser | null> {
    return await this.runUnrestricted(
      async (em) =>
        await em.transactional(async (em) => {
          const user = await em.findOne(
            this.options.entities.user,
            { id: userId } as FilterQuery<BaseUser>,
            { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!user) return null;

          const memberships = await em.find(
            this.options.entities.workspaceMember,
            { user } as FilterQuery<BaseWorkspaceMember>,
            {
              filters: false,
              lockMode: LockMode.PESSIMISTIC_WRITE,
              populate: ["workspace"] as never,
            },
          );
          if (this.ownsActiveWorkspace(memberships)) {
            throw new WorkspaceOwnershipConflictError();
          }

          await beforeDelete?.();
          await em.nativeDelete(this.sessionEntity, {
            $or: [{ userId }, { impersonatedBy: user }],
          } as FilterQuery<BaseSession>);
          await em.nativeDelete(this.accountEntity, {
            userId,
          } as FilterQuery<BaseAccount>);
          await em.nativeDelete(this.apiKeyEntity, {
            owner: user,
          } as FilterQuery<BaseApiKey>);
          await em.nativeDelete(this.workspaceInvitationEntity, {
            inviter: user,
          } as FilterQuery<BaseWorkspaceInvitation>);
          await em.nativeDelete(this.workspaceMemberEntity, {
            user,
          } as FilterQuery<BaseWorkspaceMember>);
          await em.remove(user).flush();
          return user;
        }),
    );
  }

  private ownsActiveWorkspace(
    memberships: readonly BaseWorkspaceMember[],
  ): boolean {
    const creatorRole =
      this.options.workspace?.creatorRole ?? DEFAULT_WORKSPACE_CREATOR_ROLE;

    return memberships.some((member) => {
      const workspace = Reference.unwrapReference(
        member.workspace,
      ) as unknown as BaseWorkspace;
      return member.roles.includes(creatorRole) && !workspace.deletedAt;
    });
  }

  private async runUnrestricted<T>(
    callback: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return await runAuthQuery(this.em, callback);
  }

  private get accountEntity(): EntityClass<BaseAccount> {
    return this.options.entities.account;
  }

  private get apiKeyEntity(): EntityClass<BaseApiKey> {
    return this.options.entities.apiKey;
  }

  private get sessionEntity(): EntityClass<BaseSession> {
    return this.options.entities.session;
  }

  private get workspaceInvitationEntity(): EntityClass<BaseWorkspaceInvitation> {
    return this.options.entities.workspaceInvitation;
  }

  private get workspaceMemberEntity(): EntityClass<BaseWorkspaceMember> {
    return this.options.entities.workspaceMember;
  }
}
