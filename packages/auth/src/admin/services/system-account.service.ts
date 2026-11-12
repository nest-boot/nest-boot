import { EntityManager, LockMode } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { ForbiddenException } from "@nestjs/common";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import { resolveApiKeyPermissionCatalog } from "../../api-key/utils/api-key-permissions.util.js";
import { authorize } from "../../common/utils/authorize.util.js";
import {
  assertCanGrantPermissions,
  canGrantPermissions,
} from "../../common/utils/permission-grants.util.js";
import { runAuthQuery } from "../../common/utils/run-auth-query.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { normalizeAuthPermissions } from "../../core/utils/auth-role.util.js";
import { resolveAuthFeatures } from "../../core/utils/resolve-auth-features.util.js";
import { SystemAccountConnection } from "../connections/system-account.connection-definition.js";
import type { SystemAccountPermissionOption } from "../objects/system-account-permission-option.object.js";
import { assertSystemAccountAdministrator } from "../utils/assert-system-account-administrator.util.js";

/** Input shared by programmatic and GraphQL system-account management. */
export interface CreateSystemAccountOptions {
  name: string;
  permissions?: readonly string[] | null;
}
/** Mutable fields on an independent system identity. */
export interface UpdateSystemAccountOptions {
  name?: string;
  enabled?: boolean;
  permissions?: readonly string[] | null;
}

/** Administrator-only lifecycle operations for independent system identities. */
@Injectable()
export class SystemAccountService {
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: AuthModuleOptions,
  ) {}

  /**
   * Lists platform grants that the current administrator may delegate.
   * @returns Active platform permission choices and issuer grantability.
   */
  getSystemAccountPermissions(): SystemAccountPermissionOption[] {
    this.assertAccess("read");
    return resolveApiKeyPermissionCatalog(this.options, "systemAccount")
      .permissions.filter(
        (permission) =>
          this.options.workspace?.enabled === true ||
          !permission.startsWith("workspace:"),
      )
      .map((permission) => ({
        permission,
        default: false,
        grantable: canGrantPermissions(this.options, "user", [permission]),
      }));
  }

  /**
   * Returns an account after verifying the human administrator's read grant.
   * @param id - Identifier of the target record.
   * @returns Authorized system account, or null when it is unavailable.
   */
  async getSystemAccount(id: string): Promise<SystemAccount | null> {
    this.assertAccess("read");
    return await runAuthQuery(this.em, async (em) => {
      const account = await em.findOne(SystemAccount, { id });
      if (account) {
        authorize("read", account);
      }
      return account;
    });
  }

  /**
   * Paginates platform identities without exposing them through request-role SQL.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of authorized independent system accounts.
   */
  async getSystemAccountConnection(
    args: ConnectionArgsInterface<SystemAccount>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<SystemAccount>> {
    this.assertAccess("read");
    return await runAuthQuery(this.em, async (em) => {
      const page = await new ConnectionManager(em as SqlEntityManager).find(
        SystemAccountConnection,
        args,
        { ...(info && { info }), where: {} },
      );
      for (const { node } of page.edges) {
        authorize("read", node);
      }
      return page;
    });
  }

  /**
   * Creates an independent identity with explicit, delegable platform grants.
   * @param input - Requested metadata and permission changes.
   * @returns Created independent system identity.
   */
  async createSystemAccount(
    input: CreateSystemAccountOptions,
  ): Promise<SystemAccount> {
    const user = this.assertAccess("write");
    const permissions = this.normalizePermissions(input.permissions ?? []);
    return await runAuthQuery(this.em, (manager) =>
      manager.transactional(
        async (em) => {
          const account = em.create(SystemAccount, {
            name: input.name,
            permissions,
            createdBy: user.id,
          });
          authorize("write", account);
          for (const field of ["name", "permissions"]) {
            authorize("write", account, field);
          }
          await em.persist(account).flush();
          return account;
        },
        { clear: true },
      ),
    );
  }

  /**
   * Changes the account ceiling or disables all of its credentials at once.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Persisted system identity after the changes.
   */
  async updateSystemAccount(
    id: string,
    input: UpdateSystemAccountOptions,
  ): Promise<SystemAccount> {
    this.assertAccess("write");
    const permissions =
      input.permissions === undefined
        ? undefined
        : this.normalizePermissions(input.permissions ?? []);
    return await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const account = await tx.findOne(
            SystemAccount,
            { id },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!account) {
            throw new NotFoundException("System account not found");
          }
          authorize("write", account);
          if (input.enabled === true && !account.enabled) {
            // Re-enabling restores every enabled key, so it is a delegation operation.
            assertCanGrantPermissions(
              this.options,
              "user",
              permissions ?? account.permissions,
            );
          }
          tx.assign(
            account,
            { name: input.name, enabled: input.enabled, permissions },
            { ignoreUndefined: true },
          );
          authorize("write", account);
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("write", account, field);
            }
          }
          await tx.flush();
          return account;
        },
        { clear: true },
      ),
    );
  }

  /**
   * Deletes an account and disables its retained audit keys atomically.
   * @param id - Identifier of the target record.
   * @returns Metadata of the deleted system identity.
   */
  async deleteSystemAccount(id: string): Promise<SystemAccount> {
    this.assertAccess("write");
    return await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const account = await tx.findOne(
            SystemAccount,
            { id },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!account) {
            throw new NotFoundException("System account not found");
          }
          authorize("write", account);
          // System-key persistence is only registered when its feature is enabled.
          if (resolveAuthFeatures(this.options).systemApiKey) {
            await tx.nativeUpdate(
              ApiKey,
              { ownerType: "system_account", owner: account },
              { enabled: false },
            );
          }
          await tx.nativeDelete(SystemAccount, { id });
          return account;
        },
        { clear: true },
      ),
    );
  }

  private assertAccess(action: "read" | "write") {
    if (!resolveAuthFeatures(this.options).admin) {
      throw new ForbiddenException("Administration is disabled");
    }
    const user = assertSystemAccountAdministrator(this.options);
    authorize(action, SystemAccount);
    return user;
  }

  private normalizePermissions(permissions: readonly string[]): string[] {
    const normalized = normalizeAuthPermissions(
      permissions,
      resolveApiKeyPermissionCatalog(this.options, "systemAccount").permissions,
      "System account",
    );
    assertCanGrantPermissions(this.options, "user", normalized);
    return normalized;
  }
}
