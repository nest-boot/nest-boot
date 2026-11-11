import { EntityManager, LockMode } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { SystemAccountApiKeyConnection } from "../connections/system-account-api-key.connection-definition.js";
import { ApiKeyEntity } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import { ApiKeyLifecycle } from "../infrastructure/api-key-lifecycle.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import { normalizeApiKeyPermissions } from "../utils/api-key-permissions.util.js";
import { assertApiKeyOwner } from "../utils/assert-api-key-owner.util.js";
import { assertSystemAccountAdministrator } from "../utils/assert-system-account-administrator.util.js";
import { authorize } from "../utils/authorize.util.js";
import { omitCredentials } from "../utils/omit-credentials.util.js";
import {
  assertCanGrantPermissions,
  assertPermissionCeiling,
} from "../utils/permission-grants.util.js";
import { runAuthQuery } from "../utils/run-auth-query.js";

/** Human-administrator management of credentials owned by independent system accounts. */
@Injectable()
export class SystemAccountApiKeyService {
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: AuthModuleOptions,
  ) {}

  /**
   * Returns safe metadata, restricted to system-owned rows of the shared table.
   * @param id - Identifier of the target record.
   * @returns Credential metadata, or null when it is unavailable.
   */
  async getSystemAccountApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<SystemAccountApiKey> | null> {
    this.assertAccess("read");
    return await runAuthQuery(this.em, async (em) => {
      const key = await em.findOne(
        ApiKeyEntity,
        { id, ownerType: "system_account" },
        { populate: ["owner"], exclude: ["key"] },
      );
      if (!key) {
        return null;
      }
      assertApiKeyOwner(key, "system_account");
      authorize("read", key);
      return omitCredentials(key, ["key"]);
    });
  }

  /**
   * Lists system-owned key metadata without exposing credential hashes.
   * @param systemAccountId - Identifier of the owning system account.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of system-account credential metadata without hashes.
   */
  async getSystemAccountApiKeyConnection(
    systemAccountId: string,
    args: ConnectionArgsInterface<SystemAccountApiKey>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<ApiKeyMetadata<SystemAccountApiKey>>> {
    this.assertAccess("read");
    return await runAuthQuery(this.em, async (em) => {
      const page = await new ConnectionManager(em as SqlEntityManager).find(
        SystemAccountApiKeyConnection,
        args,
        {
          ...(info && { info }),
          where: {
            ownerType: "system_account",
            owner: em.getReference(SystemAccount, systemAccountId),
          },
          populate: ["owner"],
          exclude: ["key"],
        },
      );
      for (const { node } of page.edges) {
        authorize("read", node);
      }
      return {
        ...page,
        edges: page.edges.map((edge) => ({
          ...edge,
          node: omitCredentials(edge.node, ["key"]),
        })),
      };
    });
  }

  /**
   * Issues plaintext once, bounded by account, administrator and configured ceilings.
   * @param systemAccountId - Identifier of the owning system account.
   * @param input - Requested metadata and permission changes.
   * @returns Created credential with its one-time plaintext key.
   */
  async createSystemAccountApiKey(
    systemAccountId: string,
    input: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<SystemAccountApiKey>> {
    const user = this.assertAccess("write");
    const permissions = normalizeApiKeyPermissions(
      this.options,
      "systemAccount",
      input.permissions,
    );
    assertCanGrantPermissions(this.options, "user", permissions);
    const { apiKey, data } = ApiKeyLifecycle.prepareCreation(
      input,
      permissions,
      this.options.apiKey?.systemAccount?.defaultPrefix ??
        process.env.API_KEY_PREFIX ??
        "sys_",
    );
    return await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const account = await tx.findOne(
            SystemAccount,
            { id: systemAccountId, enabled: true },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!account) {
            throw new NotFoundException("Enabled system account not found");
          }
          assertPermissionCeiling(
            permissions,
            account.permissions,
            "API key permissions exceed system account permissions",
          );
          const entity = tx.create(ApiKeyEntity, {
            ...data,
            owner: account,
            createdBy: user.id,
          });
          assertApiKeyOwner(entity, "system_account");
          authorize("write", entity);
          for (const field of ["name", "permissions"]) {
            authorize("write", entity, field);
          }
          await tx.persist(entity).flush();
          return { apiKey, entity };
        },
        { clear: true },
      ),
    );
  }

  /**
   * Changes key metadata and explicit grants after locking the owning account.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Updated credential metadata without its hash.
   */
  async updateSystemAccountApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKeyMetadata<SystemAccountApiKey>> {
    this.assertAccess("write");
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.options,
            "systemAccount",
            input.permissions,
          );
    if (permissions) {
      assertCanGrantPermissions(this.options, "user", permissions);
    }
    return await runAuthQuery(this.em, (em) =>
      em.transactional(
        async (tx) => {
          const key = await tx.findOne(
            ApiKeyEntity,
            { id, ownerType: "system_account" },
            { populate: ["owner"] },
          );
          if (!key?.systemAccount) {
            throw new NotFoundException("System account API key not found");
          }
          assertApiKeyOwner(key, "system_account");
          const account = await tx.findOneOrFail(
            SystemAccount,
            key.systemAccount.id,
            { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
          );
          if (input.enabled !== false) {
            const grants =
              permissions ??
              normalizeApiKeyPermissions(
                this.options,
                "systemAccount",
                key.permissions,
              );
            assertCanGrantPermissions(this.options, "user", grants);
            assertPermissionCeiling(
              grants,
              account.permissions,
              "API key permissions exceed system account permissions",
            );
          }
          assertApiKeyOwner(key, "system_account");
          authorize("write", key);
          const candidate = Object.assign(
            Object.create(Object.getPrototypeOf(key)) as ApiKeyEntity,
            key,
            {
              ...(input.name !== undefined && { name: input.name }),
              ...(input.enabled !== undefined && { enabled: input.enabled }),
              ...(input.expiresAt !== undefined && {
                expiresAt: input.expiresAt,
              }),
              ...(permissions !== undefined && { permissions }),
            },
          );
          authorize("write", candidate);
          for (const [field, value] of Object.entries(input)) {
            if (value !== undefined) {
              authorize("write", candidate, field);
            }
          }
          const updated = await ApiKeyLifecycle.update(
            tx,
            this.options,
            key,
            input,
            permissions,
          );
          return omitCredentials(updated, ["key"]);
        },
        { clear: true },
      ),
    );
  }

  /**
   * Revokes one system key without affecting user or member credentials.
   * @param id - Identifier of the target record.
   * @returns Metadata of the revoked credential.
   */
  async deleteSystemAccountApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<SystemAccountApiKey>> {
    this.assertAccess("write");
    return await runAuthQuery(this.em, async (em) => {
      const key = await em.findOne(ApiKeyEntity, {
        id,
        ownerType: "system_account",
      });
      if (!key) {
        throw new NotFoundException("System account API key not found");
      }
      assertApiKeyOwner(key, "system_account");
      authorize("write", key);
      await ApiKeyLifecycle.delete(em, this.options, key);
      return omitCredentials(key, ["key"]);
    });
  }

  private assertAccess(action: "read" | "write") {
    const user = assertSystemAccountAdministrator(this.options);
    authorize(action, SystemAccountApiKey);
    return user;
  }
}
