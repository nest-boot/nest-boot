import { EntityManager, type FilterQuery, LockMode } from "@mikro-orm/core";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { User } from "../entities/user.entity.js";

/** Coordinates transactional deletion of users and auth-owned dependants. */
@Injectable()
export class UserDeletionService {
  /** Creates the internal user-deletion coordinator. */
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {}

  /**
   * Deletes one user and all auth-owned dependent records atomically.
   * Workspaces survive user deletion, even when no owner remains.
   * When the injected manager has a session, root deletion retains RLS and the
   * built-in foreign keys cascade deletion to auth dependants.
   */
  async deleteUser(
    userId: string,
    beforeDelete?: () => Promise<void>,
  ): Promise<User | null> {
    const scoped = !!this.em.getContext(false).getSessionContext();
    return await this.em.transactional(
      async (em) => {
        const user = await em.findOne(
          User,
          { id: userId } as FilterQuery<User>,
          scoped
            ? { refresh: true }
            : { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!user) return null;

        await beforeDelete?.();
        // Delete only the root; foreign keys clean up dependants even under RLS.
        const count = await em.nativeDelete(User, {
          id: userId,
        } as FilterQuery<User>);
        if (count !== 1) throw new NotFoundException("User not found");
        return user;
      },
      scoped ? { clear: true } : {},
    );
  }
}
