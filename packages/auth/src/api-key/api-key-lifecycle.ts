import type { EntityManager } from "@mikro-orm/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";

import { authorize } from "../common/utils/authorize.util.js";
import type { AuthModuleOptions } from "../core/interfaces/auth-module-options.interface.js";
import { RequestIdentity } from "../core/request-identity.js";
import { ApiKey } from "./entities/api-key.entity.js";
import type { CreateApiKeyOptions } from "./interfaces/create-api-key-options.interface.js";
import type { UpdateApiKeyOptions } from "./interfaces/update-api-key-options.interface.js";
import type { ApiKeyMetadata } from "./types/api-key-metadata.type.js";
import { generateApiKey, hashApiKey } from "./utils/api-key-credential.util.js";

/**
 * Persists already-authorized key changes and publishes their committed identity effects.
 * @internal
 */
export class ApiKeyLifecycle {
  /**
   * Prepares shared credential fields without choosing an owner or authorizing persistence.
   * @param options - Configuration for this operation.
   * @param permissions - Permission names to apply.
   * @param defaultPrefix - Prefix used when no custom prefix is supplied.
   * @returns Plaintext API key and the credential fields to persist.
   */
  static prepareCreation(
    options: CreateApiKeyOptions,
    permissions: string[],
    defaultPrefix: string,
  ) {
    this.assertExpiration(options.expiresAt);
    const prefix = options.prefix ?? defaultPrefix;
    const apiKey = generateApiKey(prefix);
    return {
      apiKey,
      data: {
        revokedAt: null,
        expiresAt: options.expiresAt ?? null,
        key: hashApiKey(apiKey),
        name: options.name,
        permissions,
        prefix,
        start: apiKey.slice(0, 8),
      },
    };
  }

  /**
   * Validates expiration for both key creation and updates.
   * @param expiresAt - Requested expiration time, or null for no expiration.
   */
  static assertExpiration(expiresAt: Date | null | undefined): void {
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
  }

  /**
   * Restores managed fields on persistence failure; never publishes an uncommitted credential.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param apiKey - API key whose metadata is being accessed.
   * @param input - Requested field values for the operation.
   * @param permissions - Permission names to apply.
   * @returns API key after its changes have been persisted.
   */
  static async update<Key extends ApiKeyMetadata>(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: Key,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<Key> {
    this.assertExpiration(input.expiresAt);
    RequestIdentity.assertApiKeyCanCommit(em, apiKey);
    const previous = {
      name: apiKey.name,
      expiresAt: apiKey.expiresAt,
      permissions: apiKey.permissions,
      lastUsedAt: apiKey.lastUsedAt,
    };
    if (input.name !== undefined) {
      apiKey.name = input.name;
    }
    if (input.expiresAt !== undefined) {
      apiKey.expiresAt = input.expiresAt;
    }
    if (permissions !== undefined) {
      apiKey.permissions = permissions;
    }
    try {
      await em.persist(apiKey).flush();
    } catch (error) {
      Object.assign(apiKey, previous);
      throw error;
    }
    RequestIdentity.updateApiKey(em, options, apiKey);
    return apiKey;
  }

  /**
   * Permanently revokes a key, publishing self-revocation only after persistence succeeds.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication feature configuration.
   * @param apiKey - Authorized credential to revoke.
   * @returns Retained credential metadata with its original revocation time.
   */
  static async revoke<Key extends ApiKeyMetadata>(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: Key,
  ): Promise<Key> {
    RequestIdentity.assertApiKeyCanCommit(em, apiKey);
    authorize("write", apiKey, "revokedAt");
    if (apiKey.revokedAt) {
      return apiKey;
    }
    const revokedAt = new Date();
    const candidate = Object.assign(
      new (apiKey.constructor as new () => Key)(),
      apiKey,
      { revokedAt },
    );
    authorize("write", candidate);
    authorize("write", candidate, "revokedAt");
    // A conditional write preserves the first timestamp under concurrent revocation.
    const current = RequestIdentity.isCurrentApiKey(apiKey);
    const affected = await em.nativeUpdate(
      ApiKey,
      { id: apiKey.id, ownerType: apiKey.ownerType, revokedAt: null },
      {
        revokedAt,
        updatedAt: revokedAt,
        ...(current && { lastUsedAt: revokedAt }),
      },
    );
    if (affected) {
      apiKey.revokedAt = revokedAt;
      apiKey.updatedAt = revokedAt;
      if (current) {
        apiKey.lastUsedAt = revokedAt;
      }
    } else {
      const persisted = await em.findOne(
        ApiKey,
        { id: apiKey.id, ownerType: apiKey.ownerType },
        { refresh: true },
      );
      if (!persisted?.revokedAt) {
        throw new NotFoundException("API key not found");
      }
      apiKey.revokedAt = persisted.revokedAt;
      apiKey.updatedAt = persisted.updatedAt;
      apiKey.lastUsedAt = persisted.lastUsedAt;
    }
    RequestIdentity.updateApiKey(em, options, apiKey);
    return apiKey;
  }

  /**
   * Revokes the request identity only after deletion succeeds.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Metadata of the deleted API key.
   */
  static async delete<Key extends ApiKeyMetadata>(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: Key,
  ): Promise<Key> {
    RequestIdentity.assertApiKeyCanCommit(em, apiKey);
    await em.remove(apiKey).flush();
    RequestIdentity.updateApiKey(em, options, apiKey, true);
    return apiKey;
  }
}
